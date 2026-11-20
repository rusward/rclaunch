/// Ошибки ядра.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("invalid JSON: {0}")]
    Json(#[from] serde_json::Error),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("could not resolve application directories")]
    NoProjectDirs,

    #[error("{0}")]
    Message(String),
}

pub type Result<T> = std::result::Result<T, CoreError>;
