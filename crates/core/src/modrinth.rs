//! Поиск модов через Modrinth API v2.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha512};

use crate::error::{CoreError, Result};

const SEARCH_URL: &str = "https://api.modrinth.com/v2/search";
const PROJECT_URL: &str = "https://api.modrinth.com/v2/project";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModSearchResult {
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
pub struct InstalledMod {
    pub project_id: String,
    pub filename: String,
    pub version: String,
}

#[derive(Debug, Deserialize)]
struct ModVersion {
    #[serde(default)]
    version_number: String,
    #[serde(default)]
    files: Vec<ModFile>,
}

#[derive(Debug, Clone, Deserialize)]
struct ModFile {
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

    pub async fn search(
        &self,
        query: &str,
        game_version: Option<&str>,
        loader: Option<&str>,
        limit: Option<u8>,
    ) -> Result<Vec<ModSearchResult>> {
        let facets = build_facets(game_version, loader);
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
            .map(|hit| ModSearchResult {
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

    /// Скачивает совместимый файл мода в `mods_dir` и проверяет SHA-512.
    pub async fn install(
        &self,
        project_id: &str,
        game_version: &str,
        loader: &str,
        mods_dir: &Path,
    ) -> Result<InstalledMod> {
        let game_versions = format!("[\"{game_version}\"]");
        let loaders = format!("[\"{loader}\"]");
        let url = format!("{PROJECT_URL}/{project_id}/version");

        let versions = self
            .http
            .get(&url)
            .query(&[
                ("game_versions", game_versions.as_str()),
                ("loaders", loaders.as_str()),
            ])
            .send()
            .await?
            .error_for_status()?
            .json::<Vec<ModVersion>>()
            .await?;

        let version = versions.into_iter().next().ok_or_else(|| {
            CoreError::Message(format!(
                "no compatible version of {project_id} for {game_version}/{loader}"
            ))
        })?;

        let file = version
            .files
            .iter()
            .find(|file| file.primary)
            .or_else(|| version.files.first())
            .cloned()
            .ok_or_else(|| CoreError::Message("mod version has no files".into()))?;

        let response = self.http.get(&file.url).send().await?.error_for_status()?;
        let bytes = response.bytes().await?;

        if let Some(expected) = &file.hashes.sha512 {
            let actual = hex::encode(Sha512::digest(&bytes));
            if !actual.eq_ignore_ascii_case(expected) {
                return Err(CoreError::Message("mod file hash mismatch".into()));
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
            .ok_or_else(|| CoreError::Message("invalid mod filename".into()))?;

        fs::create_dir_all(mods_dir)?;
        fs::write(mods_dir.join(&filename), &bytes)?;
        log::info!("installed mod {project_id} as {filename}");

        Ok(InstalledMod {
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

fn build_facets(game_version: Option<&str>, loader: Option<&str>) -> String {
    let mut facets = vec!["[\"project_type:mod\"]".to_string()];

    if let Some(version) = game_version.filter(|value| !value.is_empty()) {
        facets.push(format!("[\"versions:{version}\"]"));
    }
    if let Some(loader) = loader.filter(|value| !value.is_empty()) {
        facets.push(format!("[\"categories:{loader}\"]"));
    }

    format!("[{}]", facets.join(","))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_facets() {
        assert_eq!(
            build_facets(Some("1.21.4"), Some("fabric")),
            "[[\"project_type:mod\"],[\"versions:1.21.4\"],[\"categories:fabric\"]]"
        );
        assert_eq!(build_facets(None, None), "[[\"project_type:mod\"]]");
    }

    #[test]
    fn sanitizes_filenames() {
        assert_eq!(safe_filename("sodium.jar").as_deref(), Some("sodium.jar"));
        assert_eq!(safe_filename("../evil.jar").as_deref(), Some("evil.jar"));
        assert_eq!(safe_filename(".."), None);
        assert_eq!(safe_filename(""), None);
    }
}
