//! Поиск и установка проектов Modrinth: моды, ресурспаки и шейдерпаки.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha512};

use crate::error::{CoreError, Result};

const SEARCH_URL: &str = "https://api.modrinth.com/v2/search";
const PROJECT_URL: &str = "https://api.modrinth.com/v2/project";

/// Тип проекта Modrinth. Он же определяет каталог установки в инстансе.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProjectType {
    #[serde(rename = "mod")]
    Mod,
    #[serde(rename = "resourcepack")]
    ResourcePack,
    #[serde(rename = "shader")]
    Shader,
}

impl ProjectType {
    /// Значение `project_type` в Modrinth API.
    pub fn api_value(self) -> &'static str {
        match self {
            Self::Mod => "mod",
            Self::ResourcePack => "resourcepack",
            Self::Shader => "shader",
        }
    }

    /// Каталог внутри `.minecraft` инстанса.
    pub fn directory(self) -> &'static str {
        match self {
            Self::Mod => "mods",
            Self::ResourcePack => "resourcepacks",
            Self::Shader => "shaderpacks",
        }
    }

    /// Только моды фильтруются по модлоадеру; ресурспаки и шейдеры — нет.
    pub fn uses_loader(self) -> bool {
        matches!(self, Self::Mod)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSearchResult {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub icon_url: Option<String>,
    pub downloads: u64,
    pub author: String,
    pub categories: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledProject {
    pub project_id: String,
    pub filename: String,
    pub version: String,
}

#[derive(Debug, Deserialize)]
struct ProjectVersion {
    #[serde(default)]
    version_number: String,
    #[serde(default)]
    files: Vec<ProjectFile>,
}

#[derive(Debug, Clone, Deserialize)]
struct ProjectFile {
    url: String,
    #[serde(default)]
    filename: String,
    #[serde(default)]
    primary: bool,
    #[serde(default)]
    hashes: FileHashes,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct FileHashes {
    #[serde(default)]
    sha512: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SearchResponse {
    #[serde(default)]
    hits: Vec<Hit>,
}

#[derive(Debug, Deserialize)]
struct Hit {
    project_id: String,
    slug: String,
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    icon_url: Option<String>,
    #[serde(default)]
    downloads: u64,
    #[serde(default)]
    author: String,
    #[serde(default)]
    categories: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ModrinthClient {
    http: reqwest::Client,
}

impl ModrinthClient {
    pub fn new() -> Result<Self> {
        let http = reqwest::Client::builder()
            .user_agent(concat!(
                "rclaunch/",
                env!("CARGO_PKG_VERSION"),
                " (github.com/rusward/rclaunch)"
            ))
            .build()?;
        Ok(Self { http })
    }

    /// Поиск проектов нужного типа под версию игры (и модлоадер для модов).
    pub async fn search(
        &self,
        query: &str,
        game_version: Option<&str>,
        loader: Option<&str>,
        project_type: ProjectType,
        limit: Option<u8>,
    ) -> Result<Vec<ProjectSearchResult>> {
        let facets = build_facets(project_type, game_version, loader);
        let limit = limit.unwrap_or(20).clamp(1, 50).to_string();

        let response = self
            .http
            .get(SEARCH_URL)
            .query(&[
                ("query", query),
                ("limit", limit.as_str()),
                ("index", "relevance"),
                ("facets", facets.as_str()),
            ])
            .send()
            .await?
            .error_for_status()?
            .json::<SearchResponse>()
            .await?;

        Ok(response
            .hits
            .into_iter()
            .map(|hit| ProjectSearchResult {
                id: hit.project_id,
                slug: hit.slug,
                title: hit.title,
                description: hit.description,
                icon_url: hit.icon_url,
                downloads: hit.downloads,
                author: hit.author,
                categories: hit.categories,
            })
            .collect())
    }

    /// Скачивает совместимый файл проекта в `target_dir` и проверяет SHA-512.
    pub async fn install(
        &self,
        project_type: ProjectType,
        project_id: &str,
        game_version: &str,
        loader: Option<&str>,
        target_dir: &Path,
    ) -> Result<InstalledProject> {
        let game_versions = format!("[\"{game_version}\"]");
        let loaders = loader
            .filter(|_| project_type.uses_loader())
            .map(|loader| format!("[\"{loader}\"]"));

        let url = format!("{PROJECT_URL}/{project_id}/version");
        let mut request = self
            .http
            .get(&url)
            .query(&[("game_versions", game_versions.as_str())]);
        if let Some(loaders) = loaders.as_deref() {
            request = request.query(&[("loaders", loaders)]);
        }

        let versions = request
            .send()
            .await?
            .error_for_status()?
            .json::<Vec<ProjectVersion>>()
            .await?;

        let version = versions.into_iter().next().ok_or_else(|| {
            CoreError::Message(format!(
                "no compatible version of {project_id} for {game_version}"
            ))
        })?;

        let file = version
            .files
            .iter()
            .find(|file| file.primary)
            .or_else(|| version.files.first())
            .cloned()
            .ok_or_else(|| CoreError::Message("project version has no files".into()))?;

        let response = self.http.get(&file.url).send().await?.error_for_status()?;
        let bytes = response.bytes().await?;

        if let Some(expected) = &file.hashes.sha512 {
            let actual = hex::encode(Sha512::digest(&bytes));
            if !actual.eq_ignore_ascii_case(expected) {
                return Err(CoreError::Message("project file hash mismatch".into()));
            }
        }

        let url_name = file
            .url
            .split('?')
            .next()
            .unwrap_or("")
            .rsplit('/')
            .next()
            .unwrap_or("");
        let raw_name = if file.filename.is_empty() {
            url_name
        } else {
            &file.filename
        };
        let filename = safe_filename(raw_name)
            .ok_or_else(|| CoreError::Message("invalid project filename".into()))?;

        fs::create_dir_all(target_dir)?;
        fs::write(target_dir.join(&filename), &bytes)?;
        log::info!(
            "installed {} {project_id} as {filename}",
            project_type.api_value()
        );

        Ok(InstalledProject {
            project_id: project_id.to_string(),
            filename,
            version: version.version_number,
        })
    }
}

fn safe_filename(name: &str) -> Option<String> {
    let candidate = Path::new(name.trim()).file_name()?.to_str()?.trim();
    if candidate.is_empty() || candidate == "." || candidate == ".." {
        return None;
    }
    Some(candidate.to_string())
}

fn build_facets(
    project_type: ProjectType,
    game_version: Option<&str>,
    loader: Option<&str>,
) -> String {
    let mut facets = vec![format!("[\"project_type:{}\"]", project_type.api_value())];

    if let Some(version) = game_version.filter(|value| !value.is_empty()) {
        facets.push(format!("[\"versions:{version}\"]"));
    }
    if project_type.uses_loader() {
        if let Some(loader) = loader.filter(|value| !value.is_empty()) {
            facets.push(format!("[\"categories:{loader}\"]"));
        }
    }

    format!("[{}]", facets.join(","))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_mod_facets() {
        assert_eq!(
            build_facets(ProjectType::Mod, Some("1.21.4"), Some("fabric")),
            "[[\"project_type:mod\"],[\"versions:1.21.4\"],[\"categories:fabric\"]]"
        );
        assert_eq!(
            build_facets(ProjectType::Mod, None, None),
            "[[\"project_type:mod\"]]"
        );
    }

    #[test]
    fn ignores_loader_for_assets() {
        assert_eq!(
            build_facets(ProjectType::ResourcePack, Some("1.21.4"), Some("fabric")),
            "[[\"project_type:resourcepack\"],[\"versions:1.21.4\"]]"
        );
        assert_eq!(
            build_facets(ProjectType::Shader, Some("1.21.4"), None),
            "[[\"project_type:shader\"],[\"versions:1.21.4\"]]"
        );
    }

    #[test]
    fn maps_install_directories() {
        assert_eq!(ProjectType::Mod.directory(), "mods");
        assert_eq!(ProjectType::ResourcePack.directory(), "resourcepacks");
        assert_eq!(ProjectType::Shader.directory(), "shaderpacks");
    }

    #[test]
    fn sanitizes_filenames() {
        assert_eq!(safe_filename("sodium.jar").as_deref(), Some("sodium.jar"));
        assert_eq!(safe_filename("../evil.jar").as_deref(), Some("evil.jar"));
        assert_eq!(safe_filename(".."), None);
        assert_eq!(safe_filename(""), None);
    }
}
