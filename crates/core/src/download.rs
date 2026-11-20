//! Параллельные загрузки с проверкой SHA-1 и атомарной записью.

use std::path::PathBuf;
use std::time::Duration;

use futures::{stream, StreamExt};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};

use crate::error::{CoreError, Result};

#[derive(Debug, Clone)]
pub struct DownloadTask {
    pub url: String,
    pub path: PathBuf,
    pub sha1: Option<String>,
}

impl DownloadTask {
    pub fn new(url: impl Into<String>, path: PathBuf, sha1: Option<String>) -> Self {
        Self {
            url: url.into(),
            path,
            sha1,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub completed: usize,
    pub total: usize,
}

#[derive(Debug, Clone)]
pub struct Downloader {
    http: reqwest::Client,
    concurrency: usize,
}

impl Downloader {
    pub fn new() -> Result<Self> {
        let http = reqwest::Client::builder()
            .user_agent(concat!(
                "rclaunch/",
                env!("CARGO_PKG_VERSION"),
                " (github.com/rusward/rclaunch)"
            ))
            .build()?;
        Ok(Self {
            http,
            concurrency: 12,
        })
    }

    pub async fn run(
        &self,
        tasks: Vec<DownloadTask>,
        on_progress: &(dyn Fn(DownloadProgress) + Send + Sync),
    ) -> Result<()> {
        let total = tasks.len();
        if total == 0 {
            on_progress(DownloadProgress {
                completed: 0,
                total: 0,
            });
            return Ok(());
        }

        let mut pending = stream::iter(tasks.into_iter().map(|task| self.fetch(task)))
            .buffer_unordered(self.concurrency);
        let mut completed = 0;

        while let Some(result) = pending.next().await {
            result?;
            completed += 1;
            on_progress(DownloadProgress { completed, total });
        }

        Ok(())
    }

    async fn fetch(&self, task: DownloadTask) -> Result<()> {
        if self.is_current(&task) {
            return Ok(());
        }

        let mut last_error = None;
        for attempt in 0..3 {
            match self.fetch_once(&task).await {
                Ok(()) => return Ok(()),
                Err(error) => {
                    log::warn!(
                        "download failed (attempt {}): {}: {error}",
                        attempt + 1,
                        task.url
                    );
                    last_error = Some(error);
                    tokio::time::sleep(Duration::from_millis(400 * (attempt + 1))).await;
                }
            }
        }

        Err(last_error.unwrap_or_else(|| CoreError::Message("download failed".into())))
    }

    async fn fetch_once(&self, task: &DownloadTask) -> Result<()> {
        let response = self.http.get(&task.url).send().await?;
        let status = response.status();
        if !status.is_success() {
            return Err(CoreError::Message(format!(
                "HTTP {status} for {}",
                task.url
            )));
        }

        let bytes = response.bytes().await?;
        if let Some(expected) = &task.sha1 {
            let actual = sha1_hex(&bytes);
            if !actual.eq_ignore_ascii_case(expected) {
                return Err(CoreError::Message(format!(
                    "SHA-1 mismatch for {}",
                    task.path.display()
                )));
            }
        }

        if let Some(parent) = task.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp = task.path.with_extension("part");
        std::fs::write(&tmp, &bytes)?;
        std::fs::rename(&tmp, &task.path)?;
        Ok(())
    }

    fn is_current(&self, task: &DownloadTask) -> bool {
        if !task.path.exists() {
            return false;
        }
        let Some(expected) = &task.sha1 else {
            return true;
        };
        match std::fs::read(&task.path) {
            Ok(bytes) => sha1_hex(&bytes).eq_ignore_ascii_case(expected),
            Err(_) => false,
        }
    }
}

pub fn sha1_hex(bytes: &[u8]) -> String {
    hex::encode(Sha1::digest(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_sha1() {
        assert_eq!(sha1_hex(b"abc"), "a9993e364706816aba3e25717850c26c9cd0d89d");
    }
}
