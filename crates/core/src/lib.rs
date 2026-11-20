//! Ядро rclaunch: установка и запуск Minecraft без привязки к UI.
//!
//! Крейт не знает про Tauri: его можно использовать из CLI, тестов или
//! другого фронтенда. Tauri-слой в `src-tauri` — тонкий адаптер над `Core`.

pub mod error;
pub mod mojang;
pub mod paths;

pub use error::{CoreError, Result};
pub use mojang::{LatestVersions, MojangClient, VersionEntry, VersionManifest, VersionType};
pub use paths::Paths;

/// Точка входа в ядро: держит пути и клиентов внешних API.
#[derive(Debug, Clone)]
pub struct Core {
    paths: Paths,
    mojang: MojangClient,
}

impl Core {
    /// Создаёт ядро и готовит каталоги приложения.
    pub fn new() -> Result<Self> {
        let paths = Paths::discover()?;
        paths.ensure()?;
        let core = Self {
            paths,
            mojang: MojangClient::new()?,
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

    /// Список версий Minecraft с официального манифеста Mojang.
    pub async fn version_manifest(&self) -> Result<VersionManifest> {
        self.mojang.fetch_manifest().await
    }
}
