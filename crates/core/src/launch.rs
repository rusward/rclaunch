//! Сборка classpath/аргументов и запуск Java-процесса.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

use crate::error::{CoreError, Result};
use crate::version::{
    native_classifier, native_library_classifier, resolve_library, rules_allow, DownloadInfo,
    Library, VersionJson,
};

pub struct LaunchRequest<'a> {
    pub version: &'a VersionJson,
    pub player_name: &'a str,
    pub player_uuid: &'a str,
    pub access_token: &'a str,
    pub game_dir: &'a Path,
    pub assets_dir: &'a Path,
    pub libraries_dir: &'a Path,
    pub natives_dir: &'a Path,
    pub client_jar: &'a Path,
    pub java: &'a Path,
    pub memory_mb: u32,
    pub version_type: &'a str,
}

pub fn build_command(request: &LaunchRequest<'_>) -> Result<Command> {
    let classpath = classpath(request.version, request.libraries_dir, request.client_jar)?;
    let separator = if cfg!(windows) { ";" } else { ":" };
    let assets_index = request
        .version
        .assets
        .clone()
        .or_else(|| {
            request
                .version
                .asset_index
                .as_ref()
                .map(|index| index.id.clone())
        })
        .unwrap_or_else(|| "legacy".to_string());

    let mut placeholders: HashMap<&str, String> = HashMap::new();
    placeholders.insert("${auth_player_name}", request.player_name.to_string());
    placeholders.insert("${version_name}", request.version.id.clone());
    placeholders.insert(
        "${game_directory}",
        request.game_dir.to_string_lossy().into_owned(),
    );
    placeholders.insert(
        "${assets_root}",
        request.assets_dir.to_string_lossy().into_owned(),
    );
    placeholders.insert(
        "${game_assets}",
        request.assets_dir.to_string_lossy().into_owned(),
    );
    placeholders.insert("${assets_index_name}", assets_index);
    placeholders.insert("${auth_uuid}", request.player_uuid.to_string());
    placeholders.insert("${auth_access_token}", request.access_token.to_string());
    placeholders.insert(
        "${auth_session}",
        format!("token:{}:{}", request.access_token, request.player_uuid),
    );
    placeholders.insert("${user_type}", "msa".to_string());
    placeholders.insert("${version_type}", request.version_type.to_string());
    placeholders.insert(
        "${natives_directory}",
        request.natives_dir.to_string_lossy().into_owned(),
    );
    placeholders.insert(
        "${library_directory}",
        request.libraries_dir.to_string_lossy().into_owned(),
    );
    placeholders.insert("${classpath}", classpath.clone());
    placeholders.insert("${classpath_separator}", separator.to_string());
    placeholders.insert("${launcher_name}", "rclaunch".to_string());
    placeholders.insert("${launcher_version}", env!("CARGO_PKG_VERSION").to_string());
    placeholders.insert("${user_properties}", "{}".to_string());
    placeholders.insert("${resolution_width}", "854".to_string());
    placeholders.insert("${resolution_height}", "480".to_string());

    let mut jvm_arguments = Vec::new();
    let versioned_jvm = request.version.jvm_arguments();
    if versioned_jvm.is_empty() {
        jvm_arguments.push(format!(
            "-Djava.library.path={}",
            request.natives_dir.display()
        ));
        jvm_arguments.push("-cp".to_string());
        jvm_arguments.push(classpath.clone());
    } else {
        for argument in versioned_jvm {
            jvm_arguments.push(fill(&argument, &placeholders));
        }
        if !jvm_arguments
            .iter()
            .any(|argument| argument.starts_with("-Djava.library.path"))
        {
            jvm_arguments.push(format!(
                "-Djava.library.path={}",
                request.natives_dir.display()
            ));
        }
    }

    let main_class = request
        .version
        .main_class
        .as_deref()
        .ok_or_else(|| CoreError::Message("version JSON has no mainClass".into()))?;

    let mut game_arguments = request
        .version
        .game_arguments()
        .into_iter()
        .map(|argument| fill(&argument, &placeholders))
        .collect::<Vec<_>>();

    if game_arguments.is_empty() {
        game_arguments.extend([
            "--username".to_string(),
            request.player_name.to_string(),
            "--version".to_string(),
            request.version.id.clone(),
            "--gameDir".to_string(),
            request.game_dir.to_string_lossy().into_owned(),
            "--assetsDir".to_string(),
            request.assets_dir.to_string_lossy().into_owned(),
            "--assetIndex".to_string(),
            placeholders
                .get("${assets_index_name}")
                .cloned()
                .unwrap_or_default(),
            "--uuid".to_string(),
            request.player_uuid.to_string(),
            "--accessToken".to_string(),
            request.access_token.to_string(),
            "--userType".to_string(),
            "msa".to_string(),
            "--versionType".to_string(),
            request.version_type.to_string(),
        ]);
    }

    fs::create_dir_all(request.game_dir)?;
    fs::create_dir_all(request.natives_dir)?;

    let mut command = Command::new(request.java);
    command
        .arg(format!("-Xmx{}M", request.memory_mb))
        .arg(format!("-Xms{}M", (request.memory_mb / 2).max(256)))
        .args(&jvm_arguments)
        .arg(main_class)
        .args(&game_arguments)
        .current_dir(request.game_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    Ok(command)
}

pub fn spawn(request: &LaunchRequest<'_>) -> Result<Child> {
    let mut command = build_command(request)?;
    command.spawn().map_err(|error| {
        CoreError::Message(format!(
            "failed to start Java ({}): {error}",
            request.java.display()
        ))
    })
}

/// Распаковывает natives в каталог инстанса.
pub fn extract_natives(
    version: &VersionJson,
    libraries_dir: &Path,
    natives_dir: &Path,
) -> Result<()> {
    if natives_dir.exists() {
        fs::remove_dir_all(natives_dir)?;
    }
    fs::create_dir_all(natives_dir)?;

    for library in &version.libraries {
        if !rules_allow(&library.rules) {
            continue;
        }

        let jar = native_jar(library, libraries_dir)?;
        if let Some(jar) = jar {
            extract_native_archive(&jar, natives_dir, library)?;
        }
    }

    Ok(())
}

fn native_jar(library: &Library, libraries_dir: &Path) -> Result<Option<PathBuf>> {
    if let Some(classifier) = native_classifier(library) {
        if let Some(info) = library
            .downloads
            .as_ref()
            .and_then(|downloads| downloads.classifiers.as_ref())
            .and_then(|classifiers| classifiers.get(&classifier))
        {
            return Ok(Some(libraries_dir.join(artifact_path(info)?)));
        }
    }

    if native_library_classifier(&library.name).is_some() {
        if let Some(resolved) = resolve_library(library) {
            return Ok(Some(libraries_dir.join(resolved.path)));
        }
    }

    Ok(None)
}

fn artifact_path(info: &DownloadInfo) -> Result<PathBuf> {
    info.path
        .as_ref()
        .map(PathBuf::from)
        .ok_or_else(|| CoreError::Message("library artifact has no path".into()))
}

fn extract_native_archive(jar: &Path, natives_dir: &Path, library: &Library) -> Result<()> {
    let file = fs::File::open(jar)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| CoreError::Message(format!("invalid natives jar: {error}")))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| CoreError::Message(format!("invalid natives entry: {error}")))?;

        if entry.is_dir() {
            continue;
        }

        let Some(name) = entry.enclosed_name() else {
            continue;
        };
        let name_text = name.to_string_lossy().replace('\\', "/");

        if let Some(extract) = &library.extract {
            if extract
                .path
                .iter()
                .any(|prefix| name_text.starts_with(prefix))
            {
                continue;
            }
        }

        let target = natives_dir.join(name);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut output = fs::File::create(&target)?;
        std::io::copy(&mut entry, &mut output)?;
    }

    Ok(())
}

fn classpath(version: &VersionJson, libraries_dir: &Path, client_jar: &Path) -> Result<String> {
    let mut entries = Vec::new();
    let mut seen = HashSet::new();
    let separator = if cfg!(windows) { ";" } else { ":" };

    for library in &version.libraries {
        if !rules_allow(&library.rules) {
            continue;
        }
        if native_classifier(library).is_some()
            || native_library_classifier(&library.name).is_some()
        {
            continue;
        }

        let Some(resolved) = resolve_library(library) else {
            continue;
        };

        let path = libraries_dir.join(resolved.path);
        if seen.insert(path.clone()) {
            entries.push(path);
        }
    }
    if seen.insert(client_jar.to_path_buf()) {
        entries.push(client_jar.to_path_buf());
    }

    Ok(entries
        .iter()
        .map(|path| path.to_string_lossy())
        .collect::<Vec<_>>()
        .join(separator))
}

fn fill(value: &str, placeholders: &HashMap<&str, String>) -> String {
    let mut result = value.to_string();
    for (key, replacement) in placeholders {
        result = result.replace(key, replacement);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fills_placeholders() {
        let mut map = HashMap::new();
        map.insert("${auth_player_name}", "Steve".to_string());
        map.insert("${auth_uuid}", "abc".to_string());
        assert_eq!(
            fill("--username ${auth_player_name} --uuid ${auth_uuid}", &map),
            "--username Steve --uuid abc"
        );
    }
}
