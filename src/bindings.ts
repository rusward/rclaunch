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

export type Loader = "vanilla" | "fabric" | "quilt" | "forge" | "neoforge";

export interface Instance {
  id: string;
  name: string;
  minecraftVersion: string;
  loader: Loader;
  loaderVersion: string | null;
  memoryMb: number;
  createdAt: number;
  lastPlayedAt: number | null;
}

export interface CreateInstanceRequest {
  name: string;
  minecraftVersion: string;
  loader: Loader;
  loaderVersion?: string | null;
  memoryMb?: number;
}

export interface ModSearchResult {
  id: string;
  slug: string;
  title: string;
  description: string;
  iconUrl: string | null;
  downloads: number;
  author: string;
  categories: string[];
}

export interface InstalledMod {
  projectId: string;
  filename: string;
  version: string;
}

export interface Skin {
  id: string;
  state: string;
  url: string;
  variant: string;
  alias?: string | null;
}

export interface Cape {
  id: string;
  state: string;
  url: string;
  alias?: string | null;
}

export interface Account {
  id: string;
  name: string;
  skins: Skin[];
  capes: Cape[];
  addedAt: number;
}

export interface AccountsView {
  accounts: Account[];
  activeId: string | null;
}

export interface LaunchProgress {
  completed: number;
  total: number;
}
