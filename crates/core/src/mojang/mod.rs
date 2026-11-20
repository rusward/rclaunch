//! Клиент официальных метаданных Mojang.

mod manifest;

pub use manifest::{LatestVersions, VersionEntry, VersionManifest, VersionType};

use crate::error::Result;

const VERSION_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

/// HTTP-клиент для piston-meta.
#[derive(Debug, Clone)]
pub struct MojangClient {
    http: reqwest::Client,
    manifest_url: String,
}

impl MojangClient {
    pub fn new() -> Result<Self> {
        Self::with_manifest_url(VERSION_MANIFEST_URL)
    }

    /// Позволяет подменить URL — удобно для тестов и зеркал.
    pub fn with_manifest_url(url: impl Into<String>) -> Result<Self> {
        let http = reqwest::Client::builder()
            .user_agent(concat!("rclaunch/", env!("CARGO_PKG_VERSION")))
            .build()?;
        Ok(Self {
            http,
            manifest_url: url.into(),
        })
    }

    /// Скачивает `version_manifest_v2.json`.
    pub async fn fetch_manifest(&self) -> Result<VersionManifest> {
        log::debug!("fetching version manifest: {}", self.manifest_url);
        let manifest = self
            .http
            .get(&self.manifest_url)
            .send()
            .await?
            .error_for_status()?
            .json::<VersionManifest>()
            .await?;
        log::info!("version manifest loaded: {} versions", manifest.versions.len());
        Ok(manifest)
    }
}
