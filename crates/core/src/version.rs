//! Модели version JSON Mojang и слияние профилей модлоадеров.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionJson {
    pub id: String,
    #[serde(rename = "type", default)]
    pub version_type: String,
    #[serde(default)]
    pub inherits_from: Option<String>,
    #[serde(default)]
    pub main_class: Option<String>,
    #[serde(default)]
    pub assets: Option<String>,
    #[serde(default)]
    pub asset_index: Option<AssetIndexRef>,
    #[serde(default)]
    pub downloads: Option<VersionDownloads>,
    #[serde(default)]
    pub java_version: Option<JavaVersion>,
    #[serde(default)]
    pub libraries: Vec<Library>,
    #[serde(default)]
    pub arguments: Option<VersionArguments>,
    #[serde(default)]
    pub minecraft_arguments: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetIndexRef {
    pub id: String,
    #[serde(default)]
    pub sha1: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
    #[serde(default)]
    pub total_size: Option<u64>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionDownloads {
    #[serde(default)]
    pub client: Option<DownloadInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadInfo {
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub sha1: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaVersion {
    #[serde(default)]
    pub component: String,
    #[serde(default)]
    pub major_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Library {
    pub name: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub sha1: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
    #[serde(default)]
    pub downloads: Option<LibraryDownloads>,
    #[serde(default)]
    pub natives: Option<HashMap<String, String>>,
    #[serde(default)]
    pub rules: Vec<Rule>,
    #[serde(default)]
    pub extract: Option<Extract>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryDownloads {
    #[serde(default)]
    pub artifact: Option<DownloadInfo>,
    #[serde(default)]
    pub classifiers: Option<HashMap<String, DownloadInfo>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Extract {
    #[serde(default)]
    pub path: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub action: String,
    #[serde(default)]
    pub os: Option<OsRule>,
    #[serde(default)]
    pub features: Option<HashMap<String, bool>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsRule {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub arch: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionArguments {
    #[serde(default)]
    pub game: Vec<Argument>,
    #[serde(default)]
    pub jvm: Vec<Argument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Argument {
    Plain(String),
    Conditional {
        rules: Vec<Rule>,
        value: ArgumentValue,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ArgumentValue {
    One(String),
    Many(Vec<String>),
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssetIndex {
    #[serde(default)]
    pub objects: HashMap<String, AssetObject>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssetObject {
    pub hash: String,
    #[serde(default)]
    pub size: u64,
}

impl VersionJson {
    /// Накладывает дочерний профиль (лоадер) на базовый.
    pub fn merge(parent: VersionJson, child: VersionJson) -> VersionJson {
        let mut libraries: Vec<Library> = Vec::new();
        let mut index: HashMap<String, usize> = HashMap::new();
        for library in parent.libraries.into_iter().chain(child.libraries) {
            let key = library_key(&library.name);
            if let Some(position) = index.get(&key).copied() {
                libraries[position] = library;
            } else {
                index.insert(key, libraries.len());
                libraries.push(library);
            }
        }

        let arguments = match (parent.arguments, child.arguments) {
            (Some(mut parent_args), Some(child_args)) => {
                parent_args.game.extend(child_args.game);
                parent_args.jvm.extend(child_args.jvm);
                Some(parent_args)
            }
            (parent_args, child_args) => child_args.or(parent_args),
        };

        VersionJson {
            id: child.id,
            version_type: if child.version_type.is_empty() {
                parent.version_type
            } else {
                child.version_type
            },
            inherits_from: None,
            main_class: child.main_class.or(parent.main_class),
            assets: child.assets.or(parent.assets),
            asset_index: child.asset_index.or(parent.asset_index),
            downloads: child.downloads.or(parent.downloads),
            java_version: child.java_version.or(parent.java_version),
            libraries,
            arguments,
            minecraft_arguments: child.minecraft_arguments.or(parent.minecraft_arguments),
        }
    }

    /// Аргументы JVM/игры с учётом rules.
    pub fn jvm_arguments(&self) -> Vec<String> {
        self.arguments
            .as_ref()
            .map(|arguments| resolve_arguments(&arguments.jvm))
            .unwrap_or_default()
    }

    pub fn game_arguments(&self) -> Vec<String> {
        if let Some(arguments) = &self.arguments {
            return resolve_arguments(&arguments.game);
        }

        self.minecraft_arguments
            .as_deref()
            .map(|arguments| arguments.split_whitespace().map(str::to_string).collect())
            .unwrap_or_default()
    }
}

fn resolve_arguments(arguments: &[Argument]) -> Vec<String> {
    let mut result = Vec::new();
    for argument in arguments {
        match argument {
            Argument::Plain(value) => result.push(value.clone()),
            Argument::Conditional { rules, value } if rules_allow(rules) => match value {
                ArgumentValue::One(value) => result.push(value.clone()),
                ArgumentValue::Many(values) => result.extend(values.iter().cloned()),
            },
            Argument::Conditional { .. } => {}
        }
    }
    result
}

pub fn rules_allow(rules: &[Rule]) -> bool {
    if rules.is_empty() {
        return true;
    }

    let mut allowed = false;
    for rule in rules {
        if rule_matches(rule) {
            allowed = rule.action == "allow";
        }
    }
    allowed
}

fn rule_matches(rule: &Rule) -> bool {
    if let Some(os) = &rule.os {
        if let Some(name) = &os.name {
            if name != current_os() {
                return false;
            }
        }
        if let Some(arch) = &os.arch {
            if arch != current_arch() {
                return false;
            }
        }
    }

    if let Some(features) = &rule.features {
        if features.values().any(|enabled| *enabled) {
            return false;
        }
    }

    true
}

pub fn current_os() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

pub fn current_arch() -> &'static str {
    match std::env::consts::ARCH {
        "x86" => "x86",
        "x86_64" => "x86_64",
        "aarch64" => "arm64",
        other => other,
    }
}

/// Классификатор natives для текущей ОС (например, `natives-linux`).
pub fn native_classifier(library: &Library) -> Option<String> {
    library.natives.as_ref().and_then(|natives| {
        natives.get(current_os()).map(|classifier| {
            classifier.replace("${arch}", if current_arch() == "x86" { "32" } else { "64" })
        })
    })
}

/// Имя библиотеки с классификатором (например, `natives-linux`).
pub fn native_library_classifier(name: &str) -> Option<&str> {
    name.split(':')
        .nth(3)
        .filter(|classifier| classifier.starts_with("natives-"))
}

#[derive(Debug, Clone)]
pub struct ResolvedLibrary {
    pub path: String,
    pub url: String,
    pub sha1: Option<String>,
}

/// Куда и откуда качать библиотеку: `downloads.artifact` или Maven-координаты.
pub fn resolve_library(library: &Library) -> Option<ResolvedLibrary> {
    if let Some(artifact) = library
        .downloads
        .as_ref()
        .and_then(|downloads| downloads.artifact.as_ref())
    {
        if let Some(path) = &artifact.path {
            if !artifact.url.is_empty() {
                return Some(ResolvedLibrary {
                    path: path.clone(),
                    url: artifact.url.clone(),
                    sha1: artifact.sha1.clone(),
                });
            }
        }
    }

    let path = maven_path(&library.name)?;
    let base = library
        .url
        .as_deref()
        .filter(|url| !url.is_empty())
        .unwrap_or("https://repo1.maven.org/maven2");
    let url = format!("{}/{path}", base.trim_end_matches('/'));
    Some(ResolvedLibrary {
        path,
        url,
        sha1: library.sha1.clone(),
    })
}

/// `group:artifact:version[:classifier][@ext]` → путь в Maven-репозитории.
pub fn maven_path(name: &str) -> Option<String> {
    let (coordinates, extension) = match name.split_once('@') {
        Some((coordinates, extension)) => (coordinates, extension),
        None => (name, "jar"),
    };
    let parts: Vec<&str> = coordinates.split(':').collect();
    if parts.len() < 3 {
        return None;
    }

    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let filename = match parts.get(3).filter(|classifier| !classifier.is_empty()) {
        Some(classifier) => format!("{artifact}-{version}-{classifier}.{extension}"),
        None => format!("{artifact}-{version}.{extension}"),
    };

    Some(format!("{group}/{artifact}/{version}/{filename}"))
}

/// `group:artifact:version[:classifier][@ext]` → ключ без версии.
fn library_key(name: &str) -> String {
    let mut parts = name.split(':');
    let group = parts.next().unwrap_or("");
    let artifact = parts.next().unwrap_or("");
    let _version = parts.next();
    match parts.next().filter(|classifier| !classifier.is_empty()) {
        Some(classifier) => format!("{group}:{artifact}:{classifier}"),
        None => format!("{group}:{artifact}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(action: &str, os: Option<&str>, arch: Option<&str>) -> Rule {
        Rule {
            action: action.to_string(),
            os: Some(OsRule {
                name: os.map(str::to_string),
                arch: arch.map(str::to_string),
                version: None,
            }),
            features: None,
        }
    }

    #[test]
    fn evaluates_rules() {
        assert!(rules_allow(&[]));
        assert!(rules_allow(&[rule("allow", Some(current_os()), None)]));
        assert!(!rules_allow(&[rule("allow", Some("plan9"), None)]));
        assert!(!rules_allow(&[
            rule("allow", Some(current_os()), None),
            rule("disallow", Some(current_os()), None)
        ]));
        assert!(!rules_allow(&[rule(
            "allow",
            Some(current_os()),
            Some("plan9")
        )]));
    }

    #[test]
    fn builds_maven_paths() {
        assert_eq!(
            maven_path("net.fabricmc:fabric-loader:0.20.1").as_deref(),
            Some("net/fabricmc/fabric-loader/0.20.1/fabric-loader-0.20.1.jar")
        );
        assert_eq!(
            maven_path("org.lwjgl:lwjgl:3.3.3:natives-linux").as_deref(),
            Some("org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-linux.jar")
        );
    }

    #[test]
    fn dedupes_library_versions_in_favor_of_loader() {
        let parent: VersionJson = serde_json::from_value(serde_json::json!({
            "id": "1.21.4",
            "libraries": [
                { "name": "org.ow2.asm:asm:9.6" },
                { "name": "org.lwjgl:lwjgl:3.3.3" },
                { "name": "org.lwjgl:lwjgl:3.3.3:natives-linux" }
            ]
        }))
        .unwrap();
        let child: VersionJson = serde_json::from_value(serde_json::json!({
            "id": "fabric",
            "libraries": [{ "name": "org.ow2.asm:asm:9.10.1" }]
        }))
        .unwrap();

        let merged = VersionJson::merge(parent, child);
        assert_eq!(merged.libraries.len(), 3);
        assert!(merged
            .libraries
            .iter()
            .any(|library| library.name == "org.ow2.asm:asm:9.10.1"));
        assert!(!merged
            .libraries
            .iter()
            .any(|library| library.name == "org.ow2.asm:asm:9.6"));
    }

    #[test]
    fn merges_libraries_and_arguments() {
        let parent: VersionJson = serde_json::from_value(serde_json::json!({
            "id": "1.21.4",
            "type": "release",
            "mainClass": "net.minecraft.client.main.Main",
            "assets": "17",
            "assetIndex": { "id": "17", "url": "https://example.invalid/index.json" },
            "libraries": [{ "name": "base:lib:1" }],
            "arguments": { "game": ["--username", "${auth_player_name}"], "jvm": ["-cp"] }
        }))
        .unwrap();

        let child: VersionJson = serde_json::from_value(serde_json::json!({
            "id": "fabric-loader-0.20.1-1.21.4",
            "inheritsFrom": "1.21.4",
            "mainClass": "net.fabricmc.loader.impl.launch.knot.KnotClient",
            "libraries": [{ "name": "fabric:loader:0.20.1" }],
            "arguments": { "game": [], "jvm": ["-DFabricMcEmu=1"] }
        }))
        .unwrap();

        let merged = VersionJson::merge(parent, child);
        assert_eq!(merged.id, "fabric-loader-0.20.1-1.21.4");
        assert_eq!(merged.libraries.len(), 2);
        assert_eq!(merged.jvm_arguments().len(), 2);
        assert_eq!(merged.game_arguments().len(), 2);
        assert_eq!(
            merged.main_class.as_deref(),
            Some("net.fabricmc.loader.impl.launch.knot.KnotClient")
        );
    }
}
