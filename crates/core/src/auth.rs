//! Вход через Microsoft (live.com), Xbox Live, XSTS и Minecraft Services.

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};
use crate::paths::Paths;

/// Публичный client_id Xbox-приложения (authorization code flow live.com).
pub const DEFAULT_CLIENT_ID: &str = "00000000402b5328";

const AUTHORIZE_URL: &str = "https://login.live.com/oauth20_authorize.srf";
const TOKEN_URL: &str = "https://login.live.com/oauth20_token.srf";
pub const REDIRECT_URI: &str = "https://login.live.com/oauth20_desktop.srf";
const SCOPE: &str = "service::user.auth.xboxlive.com::MBI_SSL";

const XBL_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skin {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub url: String,
    #[serde(default = "default_variant")]
    pub variant: String,
    #[serde(default)]
    pub alias: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cape {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub alias: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountProfile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub skins: Vec<Skin>,
    #[serde(default)]
    pub capes: Vec<Cape>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub skins: Vec<Skin>,
    #[serde(default)]
    pub capes: Vec<Cape>,
    pub added_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsView {
    pub accounts: Vec<Account>,
    pub active_id: Option<String>,
}

/// Активная сессия Minecraft (в памяти, без записи на диск).
#[derive(Debug, Clone)]
pub struct Session {
    pub access_token: String,
    pub expires_at: u64,
    pub profile: AccountProfile,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountsFile {
    #[serde(default)]
    accounts: Vec<Account>,
    #[serde(default)]
    active_id: Option<String>,
}

#[derive(Debug)]
pub struct AuthService {
    http: reqwest::Client,
    client_id: String,
    file: PathBuf,
    store: Mutex<AccountsFile>,
    sessions: Mutex<HashMap<String, Session>>,
}

impl AuthService {
    pub fn new(paths: &Paths) -> Result<Self> {
        let file = paths.accounts_file();
        let mut store = match fs::read(&file) {
            Ok(bytes) => serde_json::from_slice::<AccountsFile>(&bytes).unwrap_or_else(|error| {
                log::warn!("accounts file is invalid, starting empty: {error}");
                AccountsFile::default()
            }),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => AccountsFile::default(),
            Err(error) => return Err(error.into()),
        };

        for account in &mut store.accounts {
            for skin in &mut account.skins {
                skin.url = secure_texture(&skin.url);
            }
            for cape in &mut account.capes {
                cape.url = secure_texture(&cape.url);
            }
        }

        let client_id =
            std::env::var("RCLAUNCH_CLIENT_ID").unwrap_or_else(|_| DEFAULT_CLIENT_ID.to_string());
        let http = reqwest::Client::builder()
            .user_agent(concat!(
                "rclaunch/",
                env!("CARGO_PKG_VERSION"),
                " (github.com/rusward/rclaunch)"
            ))
            .build()?;

        log::info!("loaded {} account(s)", store.accounts.len());
        Ok(Self {
            http,
            client_id,
            file,
            store: Mutex::new(store),
            sessions: Mutex::new(HashMap::new()),
        })
    }

    pub fn client_id(&self) -> &str {
        &self.client_id
    }

    pub fn authorize_url(&self, state: &str) -> Result<String> {
        let url = reqwest::Url::parse_with_params(
            AUTHORIZE_URL,
            &[
                ("client_id", self.client_id.as_str()),
                ("response_type", "code"),
                ("redirect_uri", REDIRECT_URI),
                ("scope", SCOPE),
                ("state", state),
                ("prompt", "select_account"),
            ],
        )
        .map_err(|error| CoreError::Message(format!("invalid auth url: {error}")))?;
        Ok(url.to_string())
    }

    pub async fn login_with_code(&self, code: &str) -> Result<Account> {
        let msa = self.exchange_code(code).await?;
        let (profile, access_token, expires_in) = self.minecraft_session(&msa.access_token).await?;

        let now = now_millis();
        let session = Session {
            access_token,
            expires_at: now + expires_in.saturating_mul(1000),
            profile: profile.clone(),
        };

        let account = Account {
            id: profile.id.clone(),
            name: profile.name.clone(),
            skins: profile.skins.clone(),
            capes: profile.capes.clone(),
            added_at: now,
        };

        if let Some(refresh_token) = msa.refresh_token.as_deref() {
            self.store_refresh_token(&account.id, refresh_token);
        }
        self.upsert_account(account.clone())?;
        self.sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .insert(account.id.clone(), session);

        Ok(account)
    }

    pub async fn refresh_account(&self, id: &str) -> Result<Session> {
        let refresh_token = self.load_refresh_token(id)?;
        let response = self
            .http
            .post(TOKEN_URL)
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("grant_type", "refresh_token"),
                ("refresh_token", refresh_token.as_str()),
                ("redirect_uri", REDIRECT_URI),
                ("scope", SCOPE),
            ])
            .send()
            .await?;

        let msa: MsaToken = parse_response(response, "Microsoft token").await?;
        let (profile, access_token, expires_in) = self.minecraft_session(&msa.access_token).await?;

        let now = now_millis();
        let session = Session {
            access_token,
            expires_at: now + expires_in.saturating_mul(1000),
            profile: profile.clone(),
        };

        if let Some(refresh_token) = msa.refresh_token.as_deref() {
            self.store_refresh_token(id, refresh_token);
        }
        self.update_account_profile(&profile)?;
        self.sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .insert(id.to_string(), session.clone());

        Ok(session)
    }

    pub fn accounts_view(&self) -> AccountsView {
        let store = self
            .store
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let active_id = store
            .active_id
            .clone()
            .filter(|id| store.accounts.iter().any(|account| &account.id == id))
            .or_else(|| store.accounts.first().map(|account| account.id.clone()));
        AccountsView {
            accounts: store.accounts.clone(),
            active_id,
        }
    }

    pub fn set_active(&self, id: &str) -> Result<()> {
        let mut store = self
            .store
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if !store.accounts.iter().any(|account| account.id == id) {
            return Err(CoreError::Message("account not found".into()));
        }
        store.active_id = Some(id.to_string());
        self.save(&store)
    }

    pub fn logout(&self, id: &str) -> Result<()> {
        let mut store = self
            .store
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        store.accounts.retain(|account| account.id != id);
        if store.active_id.as_deref() == Some(id) {
            store.active_id = store.accounts.first().map(|account| account.id.clone());
        }
        self.save(&store)?;
        drop(store);

        self.sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(id);
        self.delete_refresh_token(id);
        Ok(())
    }

    pub fn session(&self, id: &str) -> Option<Session> {
        self.sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get(id)
            .cloned()
    }

    async fn exchange_code(&self, code: &str) -> Result<MsaToken> {
        let response = self
            .http
            .post(TOKEN_URL)
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("code", code),
                ("grant_type", "authorization_code"),
                ("redirect_uri", REDIRECT_URI),
                ("scope", SCOPE),
            ])
            .send()
            .await?;
        parse_response(response, "Microsoft token").await
    }

    async fn minecraft_session(&self, msa_token: &str) -> Result<(AccountProfile, String, u64)> {
        let xbl_response = self
            .http
            .post(XBL_URL)
            .json(&XblRequest {
                properties: XblProperties {
                    auth_method: "RPS",
                    site_name: "user.auth.xboxlive.com",
                    rps_ticket: format!("d={msa_token}"),
                },
                relying_party: "http://auth.xboxlive.com",
                token_type: "JWT",
            })
            .send()
            .await?;
        let xbl: XboxResponse = parse_response(xbl_response, "Xbox Live").await?;
        let uhs = xbl
            .display_claims
            .xui
            .first()
            .map(|xui| xui.uhs.clone())
            .ok_or_else(|| CoreError::Message("Xbox Live: no user hash".into()))?;

        let xsts_response = self
            .http
            .post(XSTS_URL)
            .json(&XstsRequest {
                properties: XstsProperties {
                    sandbox_id: "RETAIL",
                    user_tokens: vec![xbl.token.as_str()],
                },
                relying_party: "rp://api.minecraftservices.com/",
                token_type: "JWT",
            })
            .send()
            .await?;

        let status = xsts_response.status();
        let text = xsts_response.text().await?;
        if !status.is_success() {
            let error: XstsError = serde_json::from_str(&text).unwrap_or_default();
            return Err(CoreError::Message(xsts_message(error.xerr, error.message)));
        }
        let xsts: XboxResponse = serde_json::from_str(&text)?;

        let mc_response = self
            .http
            .post(MC_LOGIN_URL)
            .json(&serde_json::json!({
                "identityToken": format!("XBL3.0 x={uhs};{}", xsts.token)
            }))
            .send()
            .await?;
        let mc: McLogin = parse_response(mc_response, "Minecraft login").await?;

        let profile_response = self
            .http
            .get(MC_PROFILE_URL)
            .bearer_auth(&mc.access_token)
            .send()
            .await?;
        let profile: ProfileResponse =
            parse_response(profile_response, "Minecraft profile").await?;
        let ProfileResponse {
            id,
            name,
            mut skins,
            mut capes,
        } = profile;
        for skin in &mut skins {
            skin.url = secure_texture(&skin.url);
        }
        for cape in &mut capes {
            cape.url = secure_texture(&cape.url);
        }

        Ok((
            AccountProfile {
                id,
                name,
                skins,
                capes,
            },
            mc.access_token,
            mc.expires_in,
        ))
    }

    fn upsert_account(&self, account: Account) -> Result<()> {
        let mut store = self
            .store
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        match store
            .accounts
            .iter_mut()
            .find(|existing| existing.id == account.id)
        {
            Some(existing) => *existing = account.clone(),
            None => store.accounts.push(account.clone()),
        }
        store.active_id = Some(account.id);
        self.save(&store)
    }

    fn update_account_profile(&self, profile: &AccountProfile) -> Result<()> {
        let mut store = self
            .store
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(account) = store
            .accounts
            .iter_mut()
            .find(|account| account.id == profile.id)
        {
            account.name = profile.name.clone();
            account.skins = profile.skins.clone();
            account.capes = profile.capes.clone();
            self.save(&store)?;
        }
        Ok(())
    }

    fn save(&self, store: &AccountsFile) -> Result<()> {
        let data = serde_json::to_vec_pretty(store)?;
        let tmp = self.file.with_extension("json.tmp");
        fs::write(&tmp, data)?;
        if self.file.exists() {
            let _ = fs::remove_file(&self.file);
        }
        fs::rename(&tmp, &self.file)?;
        Ok(())
    }

    fn store_refresh_token(&self, id: &str, token: &str) {
        match keyring_entry(id).and_then(|entry| {
            entry
                .set_password(token)
                .map_err(|error| CoreError::Message(format!("keyring: {error}")))
        }) {
            Ok(()) => {}
            Err(error) => log::warn!("could not save refresh token: {error}"),
        }
    }

    fn load_refresh_token(&self, id: &str) -> Result<String> {
        let entry = keyring_entry(id)?;
        entry
            .get_password()
            .map_err(|error| CoreError::Message(format!("no saved session: {error}")))
    }

    fn delete_refresh_token(&self, id: &str) {
        if let Ok(entry) = keyring_entry(id) {
            let _ = entry.delete_credential();
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
struct MsaToken {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
}

#[derive(Debug, Serialize)]
struct XblRequest<'a> {
    #[serde(rename = "Properties")]
    properties: XblProperties<'a>,
    #[serde(rename = "RelyingParty")]
    relying_party: &'a str,
    #[serde(rename = "TokenType")]
    token_type: &'a str,
}

#[derive(Debug, Serialize)]
struct XblProperties<'a> {
    #[serde(rename = "AuthMethod")]
    auth_method: &'a str,
    #[serde(rename = "SiteName")]
    site_name: &'a str,
    #[serde(rename = "RpsTicket")]
    rps_ticket: String,
}

#[derive(Debug, Serialize)]
struct XstsRequest<'a> {
    #[serde(rename = "Properties")]
    properties: XstsProperties<'a>,
    #[serde(rename = "RelyingParty")]
    relying_party: &'a str,
    #[serde(rename = "TokenType")]
    token_type: &'a str,
}

#[derive(Debug, Serialize)]
struct XstsProperties<'a> {
    #[serde(rename = "SandboxId")]
    sandbox_id: &'a str,
    #[serde(rename = "UserTokens")]
    user_tokens: Vec<&'a str>,
}

#[derive(Debug, Deserialize)]
struct XboxResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: DisplayClaims,
}

#[derive(Debug, Deserialize)]
struct DisplayClaims {
    #[serde(default)]
    xui: Vec<Xui>,
}

#[derive(Debug, Deserialize)]
struct Xui {
    uhs: String,
}

#[derive(Debug, Default, Deserialize)]
struct XstsError {
    #[serde(rename = "XErr", default)]
    xerr: Option<u64>,
    #[serde(rename = "Message", default)]
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct McLogin {
    access_token: String,
    #[serde(default)]
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct ProfileResponse {
    id: String,
    name: String,
    #[serde(default)]
    skins: Vec<Skin>,
    #[serde(default)]
    capes: Vec<Cape>,
}

async fn parse_response<T: serde::de::DeserializeOwned>(
    response: reqwest::Response,
    context: &str,
) -> Result<T> {
    let status = response.status();
    let text = response.text().await?;
    if !status.is_success() {
        return Err(CoreError::Message(format!("{context}: {text}")));
    }
    serde_json::from_str(&text).map_err(CoreError::from)
}

fn default_variant() -> String {
    "CLASSIC".to_string()
}

/// Minecraft отдаёт текстуры по `http://`; в WebView нужен `https://`.
fn secure_texture(url: &str) -> String {
    match url.strip_prefix("http://textures.minecraft.net") {
        Some(rest) => format!("https://textures.minecraft.net{rest}"),
        None => url.to_string(),
    }
}

fn xsts_message(xerr: Option<u64>, message: Option<String>) -> String {
    match xerr {
        Some(2148916233) => "У аккаунта нет профиля Xbox. Создайте его на xbox.com.".to_string(),
        Some(2148916235) => "Xbox Live недоступен в вашем регионе.".to_string(),
        Some(2148916236) | Some(2148916237) => "Нужна проверка возраста на xbox.com.".to_string(),
        Some(2148916238) => "Детский аккаунт: добавьте его в семейную группу.".to_string(),
        _ => message.unwrap_or_else(|| format!("XSTS error: {xerr:?}")),
    }
}

fn keyring_entry(id: &str) -> Result<keyring::Entry> {
    keyring::Entry::new("rclaunch", &format!("account:{id}"))
        .map_err(|error| CoreError::Message(format!("keyring: {error}")))
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_xsts_errors() {
        assert!(xsts_message(Some(2148916233), None).contains("Xbox"));
        assert!(xsts_message(Some(2148916238), None).contains("семейную"));
        assert_eq!(
            xsts_message(None, Some("custom".into())),
            "custom".to_string()
        );
    }

    #[test]
    fn parses_profile() {
        let json = r#"{
            "id": "abc",
            "name": "Steve",
            "skins": [{"id":"s1","state":"ACTIVE","url":"https://textures.minecraft.net/x","variant":"SLIM"}],
            "capes": []
        }"#;
        let profile: AccountProfile = serde_json::from_str(json).unwrap();
        assert_eq!(profile.name, "Steve");
        assert_eq!(profile.skins[0].variant, "SLIM");
    }

    #[test]
    fn upgrades_texture_urls() {
        assert_eq!(
            secure_texture("http://textures.minecraft.net/texture/abc"),
            "https://textures.minecraft.net/texture/abc"
        );
        assert_eq!(
            secure_texture("https://textures.minecraft.net/texture/abc"),
            "https://textures.minecraft.net/texture/abc"
        );
    }
}
