use serde::{Deserialize, Serialize};

/// `version_manifest_v2.json` целиком.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<VersionEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: VersionType,
    pub url: String,
    /// Время последнего изменения записи в манифесте.
    pub time: String,
    /// Время релиза версии.
    pub release_time: String,
    #[serde(default)]
    pub sha1: Option<String>,
    #[serde(default)]
    pub compliance_level: Option<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VersionType {
    Release,
    Snapshot,
    OldBeta,
    OldAlpha,
}

impl VersionType {
    /// Человекочитаемая метка для UI.
    pub fn label(self) -> &'static str {
        match self {
            Self::Release => "release",
            Self::Snapshot => "snapshot",
            Self::OldBeta => "old_beta",
            Self::OldAlpha => "old_alpha",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_manifest_shape() {
        let json = r#"{
            "latest": { "release": "1.21.4", "snapshot": "25w02a" },
            "versions": [
                {
                    "id": "1.21.4",
                    "type": "release",
                    "url": "https://example.invalid/1.21.4.json",
                    "time": "2025-01-01T00:00:00+00:00",
                    "releaseTime": "2025-01-01T00:00:00+00:00",
                    "sha1": "abc",
                    "complianceLevel": 1
                },
                {
                    "id": "a1.0",
                    "type": "old_alpha",
                    "url": "https://example.invalid/a1.0.json",
                    "time": "2010-01-01T00:00:00+00:00",
                    "releaseTime": "2010-01-01T00:00:00+00:00"
                }
            ]
        }"#;

        let manifest: VersionManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.latest.release, "1.21.4");
        assert_eq!(manifest.versions.len(), 2);
        assert_eq!(manifest.versions[0].version_type, VersionType::Release);
        assert_eq!(manifest.versions[1].version_type, VersionType::OldAlpha);
        assert_eq!(manifest.versions[1].compliance_level, None);
    }
}
