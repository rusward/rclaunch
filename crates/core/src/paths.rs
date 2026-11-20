use std::path::PathBuf;

use directories::ProjectDirs;

use crate::error::{CoreError, Result};

/// Каталоги приложения по правилам ОС.
#[derive(Debug, Clone)]
pub struct Paths {
    config: PathBuf,
    data: PathBuf,
    cache: PathBuf,
}

impl Paths {
    pub fn discover() -> Result<Self> {
        let dirs =
            ProjectDirs::from("dev", "rclaunch", "rclaunch").ok_or(CoreError::NoProjectDirs)?;
        Ok(Self {
            config: dirs.config_dir().to_path_buf(),
            data: dirs.data_dir().to_path_buf(),
            cache: dirs.cache_dir().to_path_buf(),
        })
    }

    /// Создаёт все каталоги, если их ещё нет.
    pub fn ensure(&self) -> Result<()> {
        for dir in [
            self.config.clone(),
            self.data.clone(),
            self.cache.clone(),
            self.instances_dir(),
            self.versions_dir(),
            self.libraries_dir(),
            self.assets_dir(),
            self.runtimes_dir(),
            self.logs_dir(),
        ] {
            std::fs::create_dir_all(dir)?;
        }
        Ok(())
    }

    pub fn config(&self) -> &PathBuf {
        &self.config
    }

    pub fn data(&self) -> &PathBuf {
        &self.data
    }

    pub fn cache(&self) -> &PathBuf {
        &self.cache
    }

    /// Общий кэш version JSON и client jar.
    pub fn versions_dir(&self) -> PathBuf {
        self.data.join("versions")
    }

    pub fn libraries_dir(&self) -> PathBuf {
        self.data.join("libraries")
    }

    pub fn assets_dir(&self) -> PathBuf {
        self.data.join("assets")
    }

    pub fn runtimes_dir(&self) -> PathBuf {
        self.data.join("runtimes")
    }

    pub fn logs_dir(&self) -> PathBuf {
        self.data.join("logs")
    }

    /// Корень пользовательских инстансов.
    pub fn instances_dir(&self) -> PathBuf {
        self.data.join("instances")
    }

    pub fn instance_dir(&self, id: &str) -> PathBuf {
        self.instances_dir().join(id)
    }

    /// Изолированный игровой каталог инстанса (раскладка `.minecraft`).
    pub fn instance_game_dir(&self, id: &str) -> PathBuf {
        self.instance_dir(id).join("game")
    }

    pub fn instance_mods_dir(&self, id: &str) -> PathBuf {
        self.instance_game_dir(id).join("mods")
    }

    /// Собранные natives для инстанса.
    pub fn instance_natives_dir(&self, id: &str) -> PathBuf {
        self.instance_dir(id).join("natives")
    }

    /// Version JSON / loader-профиль конкретного инстанса.
    pub fn instance_version_dir(&self, id: &str) -> PathBuf {
        self.instance_dir(id).join("version")
    }

    pub fn instances_file(&self) -> PathBuf {
        self.config.join("instances.json")
    }

    pub fn accounts_file(&self) -> PathBuf {
        self.config.join("accounts.json")
    }
}
