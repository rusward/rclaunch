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
        for dir in [&self.config, &self.data, &self.cache, &self.game_dir()] {
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

    /// Корень игровых файлов в раскладке `.minecraft`.
    pub fn game_dir(&self) -> PathBuf {
        self.data.join("game")
    }

    pub fn versions_dir(&self) -> PathBuf {
        self.game_dir().join("versions")
    }

    pub fn libraries_dir(&self) -> PathBuf {
        self.game_dir().join("libraries")
    }

    pub fn assets_dir(&self) -> PathBuf {
        self.game_dir().join("assets")
    }

    pub fn runtimes_dir(&self) -> PathBuf {
        self.data.join("runtimes")
    }

    pub fn logs_dir(&self) -> PathBuf {
        self.data.join("logs")
    }
}
