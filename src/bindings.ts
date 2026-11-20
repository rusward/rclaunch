export type VersionType = "release" | "snapshot" | "old_beta" | "old_alpha";

export interface VersionEntry {
  id: string;
  type: VersionType;
  url: string;
  time: string;
  releaseTime: string;
  sha1?: string | null;
  complianceLevel?: number | null;
}

export interface LatestVersions {
  release: string;
  snapshot: string;
}

export interface VersionManifest {
  latest: LatestVersions;
  versions: VersionEntry[];
}

export interface AppInfo {
  name: string;
  version: string;
}
