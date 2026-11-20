//! Пользовательские инстансы: версия + модлоадер в изолированном каталоге.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{CoreError, Result};
use crate::paths::Paths;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Loader {
    #[serde(rename = "vanilla")]
    Vanilla,
    #[serde(rename = "fabric")]
    Fabric,
    #[serde(rename = "quilt")]
    Quilt,
    #[serde(rename = "forge")]
    Forge,
    #[serde(rename = "neoforge")]
    NeoForge,
}

impl Loader {
    pub fn label(self) -> &'static str {
        match self {
            Self::Vanilla => "Vanilla",
            Self::Fabric => "Fabric",
            Self::Quilt => "Quilt",
            Self::Forge => "Forge",
            Self::NeoForge => "NeoForge",
        }
    }

    /// Значение категории Modrinth; у vanilla её нет.
    pub fn modrinth_category(self) -> Option<&'static str> {
        match self {
            Self::Vanilla => None,
            Self::Fabric => Some("fabric"),
            Self::Quilt => Some("quilt"),
            Self::Forge => Some("forge"),
            Self::NeoForge => Some("neoforge"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub minecraft_version: String,
    pub loader: Loader,
    pub loader_version: Option<String>,
    pub memory_mb: u32,
    /// Unix-время в миллисекундах.
    pub created_at: u64,
    pub last_played_at: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInstance {
    pub name: String,
    pub minecraft_version: String,
    pub loader: Loader,
    #[serde(default)]
    pub loader_version: Option<String>,
    #[serde(default)]
    pub memory_mb: Option<u32>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoreFile {
    #[serde(default)]
    instances: Vec<Instance>,
}

/// Хранилище инстансов в `config/instances.json`.
#[derive(Debug)]
pub struct InstanceService {
    root: PathBuf,
    file: PathBuf,
    instances: Mutex<Vec<Instance>>,
}

impl InstanceService {
    pub fn load(paths: &Paths) -> Result<Self> {
        let file = paths.instances_file();
        let store = match fs::read(&file) {
            Ok(bytes) => match serde_json::from_slice::<StoreFile>(&bytes) {
                Ok(store) => store,
                Err(error) => {
                    log::warn!("instances file is invalid, starting empty: {error}");
                    StoreFile::default()
                }
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => StoreFile::default(),
            Err(error) => return Err(error.into()),
        };

        log::info!("loaded {} instance(s)", store.instances.len());
        Ok(Self {
            root: paths.instances_dir(),
            file,
            instances: Mutex::new(store.instances),
        })
    }

    pub fn list(&self) -> Vec<Instance> {
        let mut instances = self.lock().clone();
        instances.sort_by(|a, b| {
            let a_time = a.last_played_at.unwrap_or(a.created_at);
            let b_time = b.last_played_at.unwrap_or(b.created_at);
            b_time.cmp(&a_time)
        });
        instances
    }

    pub fn get(&self, id: &str) -> Option<Instance> {
        self.lock()
            .iter()
            .find(|instance| instance.id == id)
            .cloned()
    }

    pub fn create(&self, request: CreateInstance) -> Result<Instance> {
        let name = validate_name(&request.name)?;
        let minecraft_version = request.minecraft_version.trim().to_string();
        if minecraft_version.is_empty() {
            return Err(CoreError::Message(
                "minecraft version must not be empty".into(),
            ));
        }

        let loader_version = request
            .loader_version
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let memory_mb = request.memory_mb.unwrap_or(4096).clamp(512, 65536);

        let id = format!(
            "{}-{}",
            slugify(&name),
            &Uuid::new_v4().simple().to_string()[..8]
        );

        let instance = Instance {
            id: id.clone(),
            name,
            minecraft_version,
            loader: request.loader,
            loader_version,
            memory_mb,
            created_at: now_millis(),
            last_played_at: None,
        };

        let game_dir = self.root.join(&id).join("game");
        fs::create_dir_all(game_dir.join("mods"))?;

        {
            let mut instances = self.lock();
            instances.push(instance.clone());
            if let Err(error) = self.save(&instances) {
                instances.pop();
                return Err(error);
            }
        }

        log::info!("created instance {}", instance.id);
        Ok(instance)
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        if !is_safe_id(id) {
            return Err(CoreError::Message("invalid instance id".into()));
        }

        {
            let mut instances = self.lock();
            let before = instances.len();
            instances.retain(|instance| instance.id != id);
            if instances.len() == before {
                return Err(CoreError::Message("instance not found".into()));
            }
            self.save(&instances)?;
        }

        let dir = self.root.join(id);
        if dir.exists() {
            fs::remove_dir_all(dir)?;
        }
        log::info!("deleted instance {id}");
        Ok(())
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Vec<Instance>> {
        self.instances
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn save(&self, instances: &[Instance]) -> Result<()> {
        let store = StoreFile {
            instances: instances.to_vec(),
        };
        let data = serde_json::to_vec_pretty(&store)?;
        let tmp = self.file.with_extension("json.tmp");
        fs::write(&tmp, data)?;
        if self.file.exists() {
            // На Unix rename атомарен и заменяет файл; на Windows — удаляем.
            let _ = fs::remove_file(&self.file);
        }
        fs::rename(&tmp, &self.file)?;
        Ok(())
    }
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn validate_name(name: &str) -> Result<String> {
    let name = name.trim();
    let length = name.chars().count();
    if length == 0 {
        return Err(CoreError::Message("instance name must not be empty".into()));
    }
    if length > 64 {
        return Err(CoreError::Message(
            "instance name must be 64 characters or fewer".into(),
        ));
    }
    if name.chars().any(char::is_control) {
        return Err(CoreError::Message(
            "instance name contains invalid characters".into(),
        ));
    }
    Ok(name.to_string())
}

fn slugify(name: &str) -> String {
    let mut slug = String::new();
    let mut pending_dash = false;

    for character in name.chars().flat_map(char::to_lowercase) {
        if character.is_ascii_alphanumeric() {
            slug.push(character);
            pending_dash = false;
        } else if !slug.is_empty() && !pending_dash {
            slug.push('-');
            pending_dash = true;
        }
    }

    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "instance".to_string()
    } else {
        slug.chars().take(24).collect()
    }
}

fn is_safe_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugifies_names() {
        assert_eq!(slugify("My Vanilla Pack"), "my-vanilla-pack");
        assert_eq!(slugify("  Fabric!! 1.21  "), "fabric-1-21");
        assert_eq!(slugify("Привет"), "instance");
    }

    #[test]
    fn validates_ids() {
        assert!(is_safe_id("fabric-abc12345"));
        assert!(!is_safe_id("../escape"));
        assert!(!is_safe_id(""));
    }

    #[test]
    fn serializes_loader_names() {
        assert_eq!(
            serde_json::to_string(&Loader::NeoForge).unwrap(),
            "\"neoforge\""
        );
        assert_eq!(
            serde_json::to_string(&Loader::Vanilla).unwrap(),
            "\"vanilla\""
        );
    }
}
