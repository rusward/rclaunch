//! Ядро rclaunch: установка и запуск Minecraft без привязки к UI.
//!
//! Крейт не знает про Tauri: его можно использовать из CLI, тестов или
//! другого фронтенда. Tauri-слой в `src-tauri` — тонкий адаптер над `Core`.

pub mod auth;
pub mod download;
pub mod error;
pub mod instances;
pub mod java;
pub mod launch;
pub mod modrinth;
pub mod mojang;
pub mod paths;
pub mod prepare;
pub mod version;

use std::path::Path;

pub use auth::{Account, AccountProfile, AccountsView, AuthService, Cape, Session, Skin};
pub use download::DownloadProgress;
pub use error::{CoreError, Result};
pub use instances::{CreateInstance, Instance, InstanceService, Loader};
pub use modrinth::{InstalledMod, ModSearchResult, ModrinthClient};
pub use mojang::{LatestVersions, MojangClient, VersionEntry, VersionManifest, VersionType};
pub use paths::Paths;
pub use prepare::{LaunchReporter, PreparedLaunch};

/// Точка входа в ядро: держит пути и клиентов внешних API.
#[derive(Debug, Clone)]
pub struct Core {
    paths: Paths,
    mojang: MojangClient,
    modrinth: ModrinthClient,
}

impl Core {
    /// Создаёт ядро и готовит каталоги приложения.
    pub fn new() -> Result<Self> {
        let paths = Paths::discover()?;
        paths.ensure()?;
        let core = Self {
            paths,
            mojang: MojangClient::new()?,
            modrinth: ModrinthClient::new()?,
        };
        log::info!("core initialized at {}", core.paths.data().display());
        Ok(core)
    }

    pub fn paths(&self) -> &Paths {
        &self.paths
    }

    pub fn mojang(&self) -> &MojangClient {
        &self.mojang
    }

    pub fn modrinth(&self) -> &ModrinthClient {
        &self.modrinth
    }

    /// Список версий Minecraft с официального манифеста Mojang.
    pub async fn version_manifest(&self) -> Result<VersionManifest> {
        self.mojang.fetch_manifest().await
    }

    pub async fn search_mods(
        &self,
        query: &str,
        game_version: Option<&str>,
        loader: Option<&str>,
    ) -> Result<Vec<ModSearchResult>> {
        self.modrinth
            .search(query, game_version, loader, None)
            .await
    }

    pub async fn install_mod(
        &self,
        project_id: &str,
        game_version: &str,
        loader: &str,
        mods_dir: &Path,
    ) -> Result<InstalledMod> {
        self.modrinth
            .install(project_id, game_version, loader, mods_dir)
            .await
    }
}
