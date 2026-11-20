//! Подготовка файлов и запуск инстанса.

use std::collections::HashSet;
use std::path::PathBuf;
use std::process::Child;

use serde::Deserialize;

use crate::auth::AccountProfile;
use crate::download::{DownloadProgress, DownloadTask, Downloader};
use crate::error::{CoreError, Result};
use crate::instances::{Instance, Loader};
use crate::java::ensure_java;
use crate::launch::{self, LaunchRequest};
use crate::mojang::VersionManifest;
use crate::paths::Paths;
use crate::version::{
    native_classifier, resolve_library, rules_allow, AssetIndex, ResolvedLibrary, VersionJson,
};

pub trait LaunchReporter: Send + Sync {
    fn stage(&self, stage: &str);
    fn download(&self, progress: DownloadProgress);
}

pub struct PreparedLaunch {
    pub child: Child,
    pub loader_version: Option<String>,
}

pub async fn prepare_and_launch(
    paths: &Paths,
    manifest: &VersionManifest,
    instance: &Instance,
    account: &AccountProfile,
    access_token: &str,
    reporter: &dyn LaunchReporter,
) -> Result<PreparedLaunch> {
    let downloader = Downloader::new()?;
    let on_progress = |progress: DownloadProgress| reporter.download(progress);

    let entry = manifest
        .versions
        .iter()
        .find(|entry| entry.id == instance.minecraft_version)
        .ok_or_else(|| {
            CoreError::Message(format!(
                "version {} not found in Mojang manifest",
                instance.minecraft_version
            ))
        })?;

    reporter.stage("version");
    let version_dir = paths.versions_dir().join(&entry.id);
    std::fs::create_dir_all(&version_dir)?;
    let version_path = version_dir.join(format!("{}.json", entry.id));
    downloader
        .run(
            vec![DownloadTask::new(
                entry.url.clone(),
                version_path.clone(),
                entry.sha1.clone(),
            )],
            &on_progress,
        )
        .await?;
    let mut version: VersionJson = serde_json::from_slice(&std::fs::read(&version_path)?)?;

    let mut loader_version = None;
    if instance.loader != Loader::Vanilla {
        reporter.stage("loader");
        let (profile, resolved) =
            load_loader_profile(instance, paths, &downloader, &on_progress).await?;
        loader_version = Some(resolved);
        version = VersionJson::merge(version, profile);
    }

    reporter.stage("libraries");
    let mut library_tasks = Vec::new();
    let mut seen = HashSet::new();
    let libraries_dir = paths.libraries_dir();

    for library in &version.libraries {
        if !rules_allow(&library.rules) {
            continue;
        }
        if let Some(resolved) = resolve_library(library) {
            push_resolved(&mut library_tasks, &mut seen, &libraries_dir, resolved);
        }
        if let Some(classifier) = native_classifier(library) {
            if let Some(info) = library
                .downloads
                .as_ref()
                .and_then(|downloads| downloads.classifiers.as_ref())
                .and_then(|classifiers| classifiers.get(&classifier))
            {
                if let Some(path) = &info.path {
                    push_task(&mut library_tasks, &mut seen, &libraries_dir, info, path);
                }
            }
        }
    }

    downloader.run(library_tasks, &on_progress).await?;

    reporter.stage("assets");
    let assets_dir = paths.assets_dir();
    if let Some(index) = &version.asset_index {
        let index_path = assets_dir
            .join("indexes")
            .join(format!("{}.json", index.id));
        downloader
            .run(
                vec![DownloadTask::new(
                    index.url.clone(),
                    index_path.clone(),
                    index.sha1.clone(),
                )],
                &on_progress,
            )
            .await?;
        let index: AssetIndex = serde_json::from_slice(&std::fs::read(&index_path)?)?;
        let mut asset_tasks = Vec::new();
        let mut seen = HashSet::new();

        for object in index.objects.values() {
            if object.hash.len() < 2 {
                continue;
            }
            let prefix = &object.hash[..2];
            let path = assets_dir.join("objects").join(prefix).join(&object.hash);
            if seen.insert(path.clone()) {
                asset_tasks.push(DownloadTask::new(
                    format!(
                        "https://resources.download.minecraft.net/{prefix}/{}",
                        object.hash
                    ),
                    path,
                    Some(object.hash.clone()),
                ));
            }
        }

        downloader.run(asset_tasks, &on_progress).await?;
    }

    reporter.stage("java");
    let required_java = version
        .java_version
        .as_ref()
        .map(|java| java.major_version)
        .filter(|major| *major > 0)
        .unwrap_or(8);
    let java = ensure_java(paths, required_java, &downloader, &on_progress).await?;

    reporter.stage("natives");
    let natives_dir = paths.instance_natives_dir(&instance.id);
    launch::extract_natives(&version, &libraries_dir, &natives_dir)?;

    reporter.stage("launch");
    let client_jar = version_dir.join(format!("{}.jar", instance.minecraft_version));
    let client = version
        .downloads
        .as_ref()
        .and_then(|downloads| downloads.client.as_ref())
        .ok_or_else(|| CoreError::Message("version JSON has no client download".into()))?;
    downloader
        .run(
            vec![DownloadTask::new(
                client.url.clone(),
                client_jar.clone(),
                client.sha1.clone(),
            )],
            &on_progress,
        )
        .await?;

    let game_dir = paths.instance_game_dir(&instance.id);
    std::fs::create_dir_all(&game_dir)?;
    std::fs::create_dir_all(paths.instance_mods_dir(&instance.id))?;

    let version_type = if version.version_type.is_empty() {
        "release"
    } else {
        version.version_type.as_str()
    };

    let child = launch::spawn(&LaunchRequest {
        version: &version,
        player_name: &account.name,
        player_uuid: &account.id,
        access_token,
        game_dir: &game_dir,
        assets_dir: &assets_dir,
        libraries_dir: &libraries_dir,
        natives_dir: &natives_dir,
        client_jar: &client_jar,
        java: &java,
        memory_mb: instance.memory_mb,
        version_type,
    })?;

    Ok(PreparedLaunch {
        child,
        loader_version,
    })
}

fn push_resolved(
    tasks: &mut Vec<DownloadTask>,
    seen: &mut HashSet<PathBuf>,
    libraries_dir: &std::path::Path,
    resolved: ResolvedLibrary,
) {
    let target = libraries_dir.join(resolved.path);
    if seen.insert(target.clone()) {
        tasks.push(DownloadTask::new(resolved.url, target, resolved.sha1));
    }
}

fn push_task(
    tasks: &mut Vec<DownloadTask>,
    seen: &mut HashSet<PathBuf>,
    libraries_dir: &std::path::Path,
    info: &crate::version::DownloadInfo,
    path: &str,
) {
    let target = libraries_dir.join(path);
    if seen.insert(target.clone()) {
        tasks.push(DownloadTask::new(
            info.url.clone(),
            target,
            info.sha1.clone(),
        ));
    }
}

#[derive(Debug, Deserialize)]
struct LoaderEntry {
    loader: LoaderInfo,
}

#[derive(Debug, Deserialize)]
struct LoaderInfo {
    version: String,
    #[serde(default)]
    stable: bool,
}

async fn load_loader_profile(
    instance: &Instance,
    paths: &Paths,
    downloader: &Downloader,
    on_progress: &(dyn Fn(DownloadProgress) + Send + Sync),
) -> Result<(VersionJson, String)> {
    let (meta_base, loader_name) = match instance.loader {
        Loader::Fabric => ("https://meta.fabricmc.net/v2/versions/loader", "fabric"),
        Loader::Quilt => ("https://meta.quiltmc.org/v3/versions/loader", "quilt"),
        Loader::Vanilla => {
            return Err(CoreError::Message("vanilla has no loader profile".into()));
        }
        Loader::Forge | Loader::NeoForge => {
            return Err(CoreError::Message(
                "Forge/NeoForge launch is not implemented yet".into(),
            ));
        }
    };

    let versions_url = format!("{meta_base}/{}", instance.minecraft_version);

    let loader_version = match &instance.loader_version {
        Some(version) if !version.is_empty() => version.clone(),
        _ => {
            let list_path = paths
                .instance_version_dir(&instance.id)
                .join(format!("{loader_name}-versions.json"));
            downloader
                .run(
                    vec![DownloadTask::new(versions_url, list_path.clone(), None)],
                    on_progress,
                )
                .await?;
            let entries: Vec<LoaderEntry> = serde_json::from_slice(&std::fs::read(&list_path)?)?;
            entries
                .iter()
                .find(|entry| entry.loader.stable)
                .or_else(|| entries.first())
                .map(|entry| entry.loader.version.clone())
                .ok_or_else(|| {
                    CoreError::Message(format!(
                        "no {loader_name} loader versions for {}",
                        instance.minecraft_version
                    ))
                })?
        }
    };

    let profile_url = format!(
        "{meta_base}/{}/{}/profile/json",
        instance.minecraft_version, loader_version
    );

    let profile_path = paths
        .instance_version_dir(&instance.id)
        .join(format!("{loader_name}-{loader_version}.json"));
    downloader
        .run(
            vec![DownloadTask::new(profile_url, profile_path.clone(), None)],
            on_progress,
        )
        .await?;
    let profile: VersionJson = serde_json::from_slice(&std::fs::read(&profile_path)?)?;

    Ok((profile, loader_version))
}
