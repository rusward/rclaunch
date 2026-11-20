//! Подбор системной Java или загрузка JRE с Adoptium.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::download::{DownloadProgress, DownloadTask, Downloader};
use crate::error::{CoreError, Result};
use crate::paths::Paths;

const ADOPTIUM_URL: &str = "https://api.adoptium.net/v3/binary/latest";

/// Возвращает путь к Java нужной мажорной версии.
pub async fn ensure_java(
    paths: &Paths,
    required_major: u32,
    downloader: &Downloader,
    on_progress: &(dyn Fn(DownloadProgress) + Send + Sync),
) -> Result<PathBuf> {
    if let Ok(path) = std::env::var("RCLAUNCH_JAVA") {
        return Ok(PathBuf::from(path));
    }

    if let Some(path) = bundled_java(paths, required_major) {
        return Ok(path);
    }

    if let Some((path, major)) = system_java() {
        if major == required_major || (required_major >= 17 && major >= 17) {
            log::info!("using system Java {major} at {}", path.display());
            return Ok(path);
        }
    }

    download_java(paths, required_major, downloader, on_progress).await
}

fn bundled_java(paths: &Paths, major: u32) -> Option<PathBuf> {
    let path = runtime_bin(paths, major);
    path.exists().then_some(path)
}

fn runtime_bin(paths: &Paths, major: u32) -> PathBuf {
    paths
        .runtimes_dir()
        .join(format!("temurin-{major}"))
        .join("bin")
        .join(if cfg!(windows) { "java.exe" } else { "java" })
}

fn system_java() -> Option<(PathBuf, u32)> {
    let output = Command::new("java").arg("-version").output().ok()?;
    let text = String::from_utf8_lossy(&output.stderr);
    let major = parse_java_major(&text)?;
    Some((PathBuf::from("java"), major))
}

fn parse_java_major(output: &str) -> Option<u32> {
    let version = output.split('"').nth(1)?;
    let first = version.split('.').next()?;
    if first == "1" {
        version.split('.').nth(1)?.parse().ok()
    } else {
        first.parse().ok()
    }
}

async fn download_java(
    paths: &Paths,
    major: u32,
    downloader: &Downloader,
    on_progress: &(dyn Fn(DownloadProgress) + Send + Sync),
) -> Result<PathBuf> {
    let os = adoptium_os();
    let arch = adoptium_arch()?;
    let extension = if cfg!(windows) { "zip" } else { "tar.gz" };
    let url = format!("{ADOPTIUM_URL}/{major}/ga/{os}/{arch}/jre/hotspot/normal/eclipse");

    let downloads = paths.runtimes_dir().join("downloads");
    fs::create_dir_all(&downloads)?;
    let archive = downloads.join(format!("temurin-{major}.{extension}"));

    if archive.exists() {
        let _ = fs::remove_file(&archive);
    }

    log::info!("downloading Java {major} from Adoptium");
    downloader
        .run(
            vec![DownloadTask::new(url, archive.clone(), None)],
            on_progress,
        )
        .await?;

    let target = paths.runtimes_dir().join(format!("temurin-{major}"));
    if target.exists() {
        fs::remove_dir_all(&target)?;
    }

    let extract_dir = paths.runtimes_dir().join(format!(".extract-{major}"));
    if extract_dir.exists() {
        fs::remove_dir_all(&extract_dir)?;
    }
    fs::create_dir_all(&extract_dir)?;

    extract_archive(&archive, &extract_dir)?;

    let java = find_java(&extract_dir, 0)
        .ok_or_else(|| CoreError::Message("Java executable not found in archive".into()))?;
    let root = java
        .parent()
        .and_then(Path::parent)
        .ok_or_else(|| CoreError::Message("invalid Java archive layout".into()))?;

    fs::rename(root, &target)?;
    let _ = fs::remove_dir_all(&extract_dir);

    let path = target
        .join("bin")
        .join(if cfg!(windows) { "java.exe" } else { "java" });
    if !path.exists() {
        return Err(CoreError::Message(
            "Java was extracted but binary is missing".into(),
        ));
    }

    log::info!("Java {major} installed at {}", path.display());
    Ok(path)
}

fn extract_archive(archive: &Path, target: &Path) -> Result<()> {
    if cfg!(windows) {
        extract_zip(archive, target)
    } else {
        extract_tar_gz(archive, target)
    }
}

fn extract_tar_gz(archive: &Path, target: &Path) -> Result<()> {
    let file = fs::File::open(archive)?;
    let decoder = flate2::read::GzDecoder::new(file);
    let mut tar = tar::Archive::new(decoder);
    tar.unpack(target)?;
    Ok(())
}

#[cfg(windows)]
fn extract_zip(archive: &Path, target: &Path) -> Result<()> {
    let file = fs::File::open(archive)?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|error| CoreError::Message(format!("invalid Java archive: {error}")))?;

    for index in 0..zip.len() {
        let mut entry = zip
            .by_index(index)
            .map_err(|error| CoreError::Message(format!("invalid zip entry: {error}")))?;
        let Some(name) = entry.enclosed_name() else {
            continue;
        };
        let path = target.join(name);
        if entry.is_dir() {
            fs::create_dir_all(&path)?;
        } else {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut output = fs::File::create(&path)?;
            std::io::copy(&mut entry, &mut output)?;
        }
    }
    Ok(())
}

#[cfg(not(windows))]
fn extract_zip(_archive: &Path, _target: &Path) -> Result<()> {
    Err(CoreError::Message("zip extraction is not supported".into()))
}

fn find_java(dir: &Path, depth: usize) -> Option<PathBuf> {
    if depth > 4 {
        return None;
    }

    let candidate = dir
        .join("bin")
        .join(if cfg!(windows) { "java.exe" } else { "java" });
    if candidate.is_file() {
        return Some(candidate);
    }

    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        if entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false) {
            if let Some(found) = find_java(&entry.path(), depth + 1) {
                return Some(found);
            }
        }
    }
    None
}

fn adoptium_os() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "mac"
    } else {
        "linux"
    }
}

fn adoptium_arch() -> Result<&'static str> {
    match std::env::consts::ARCH {
        "x86_64" => Ok("x64"),
        "aarch64" => Ok("aarch64"),
        "x86" => Ok("x86"),
        other => Err(CoreError::Message(format!(
            "unsupported architecture for Java: {other}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_java_versions() {
        assert_eq!(
            parse_java_major("openjdk version \"25.0.4\" 2026-08-18"),
            Some(25)
        );
        assert_eq!(
            parse_java_major("java version \"1.8.0_402\"\nJava(TM) SE"),
            Some(8)
        );
        assert_eq!(parse_java_major("no version here"), None);
    }

    #[test]
    fn has_adoptium_arch() {
        assert!(adoptium_arch().is_ok());
    }
}
