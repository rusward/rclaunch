import { invoke } from "@tauri-apps/api/core";

import type {
  AppInfo,
  CreateInstanceRequest,
  Instance,
  InstalledMod,
  Loader,
  ModSearchResult,
  VersionManifest,
} from "../bindings";

const MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const MODRINTH_URL = "https://api.modrinth.com/v2/search";
const LOCAL_INSTANCES_KEY = "rclaunch.instances.v1";

/**
 * В обычном браузере (без Tauri) UI тоже должен работать — это ускоряет
 * разработку. В приложении всегда используется Rust-команда.
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function fetchManifestInBrowser(): Promise<VersionManifest> {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`Mojang API вернул HTTP ${response.status}`);
  }
  return (await response.json()) as VersionManifest;
}

function readLocalInstances(): Instance[] {
  try {
    const raw = localStorage.getItem(LOCAL_INSTANCES_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Instance[]) : [];
  } catch {
    return [];
  }
}

function writeLocalInstances(instances: Instance[]) {
  localStorage.setItem(LOCAL_INSTANCES_KEY, JSON.stringify(instances));
}

function localListInstances(): Instance[] {
  return readLocalInstances().sort((a, b) => {
    const aTime = a.lastPlayedAt ?? a.createdAt;
    const bTime = b.lastPlayedAt ?? b.createdAt;
    return bTime - aTime;
  });
}

function localCreateInstance(request: CreateInstanceRequest): Instance {
  const now = Date.now();
  const slug =
    request.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "instance";
  const suffix = Math.random().toString(36).slice(2, 10);
  const loaderVersion = request.loaderVersion?.trim();

  const instance: Instance = {
    id: `${slug}-${suffix}`,
    name: request.name.trim(),
    minecraftVersion: request.minecraftVersion,
    loader: request.loader,
    loaderVersion: loaderVersion ? loaderVersion : null,
    memoryMb: request.memoryMb ?? 4096,
    createdAt: now,
    lastPlayedAt: null,
  };

  writeLocalInstances([...readLocalInstances(), instance]);
  return instance;
}

function localDeleteInstance(id: string): void {
  writeLocalInstances(readLocalInstances().filter((item) => item.id !== id));
}

function loaderCategory(loader: Loader): string | null {
  return loader === "vanilla" ? null : loader;
}

async function searchModsInBrowser(
  query: string,
  gameVersion: string | null,
  loader: Loader | null,
): Promise<ModSearchResult[]> {
  const facets: string[][] = [["project_type:mod"]];
  if (gameVersion) {
    facets.push([`versions:${gameVersion}`]);
  }
  const category = loader ? loaderCategory(loader) : null;
  if (category) {
    facets.push([`categories:${category}`]);
  }

  const params = new URLSearchParams({
    query,
    limit: "20",
    index: "relevance",
    facets: JSON.stringify(facets),
  });

  const response = await fetch(`${MODRINTH_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Modrinth вернул HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    hits?: Array<{
      project_id: string;
      slug: string;
      title: string;
      description?: string;
      icon_url?: string | null;
      downloads?: number;
      author?: string;
      categories?: string[];
    }>;
  };

  return (data.hits ?? []).map((hit) => ({
    id: hit.project_id,
    slug: hit.slug,
    title: hit.title,
    description: hit.description ?? "",
    iconUrl: hit.icon_url ?? null,
    downloads: hit.downloads ?? 0,
    author: hit.author ?? "",
    categories: hit.categories ?? [],
  }));
}

/**
 * Единственное место, где UI знает имена Tauri-команд.
 * Держим его синхронным с `src-tauri/src/commands.rs`.
 */
export const ipc = {
  appInfo: (): Promise<AppInfo> =>
    isTauri()
      ? invoke<AppInfo>("app_info")
      : Promise.resolve({ name: "rclaunch", version: "0.1.0-dev" }),

  versionsManifest: (): Promise<VersionManifest> =>
    isTauri()
      ? invoke<VersionManifest>("versions_manifest")
      : fetchManifestInBrowser(),

  instancesList: (): Promise<Instance[]> =>
    isTauri()
      ? invoke<Instance[]>("instances_list")
      : Promise.resolve(localListInstances()),

  instancesCreate: (request: CreateInstanceRequest): Promise<Instance> =>
    isTauri()
      ? invoke<Instance>("instances_create", { request })
      : Promise.resolve(localCreateInstance(request)),

  instancesDelete: (id: string): Promise<void> =>
    isTauri()
      ? invoke<void>("instances_delete", { id })
      : Promise.resolve(localDeleteInstance(id)),

  modrinthSearch: (
    query: string,
    gameVersion: string | null,
    loader: Loader | null,
  ): Promise<ModSearchResult[]> =>
    isTauri()
      ? invoke<ModSearchResult[]>("modrinth_search", {
          query,
          gameVersion,
          loader: loader ? loaderCategory(loader) : null,
        })
      : searchModsInBrowser(query, gameVersion, loader),

  modrinthInstall: (
    instanceId: string,
    projectId: string,
  ): Promise<InstalledMod> =>
    isTauri()
      ? invoke<InstalledMod>("modrinth_install", { instanceId, projectId })
      : Promise.reject(
          new Error("Установка модов доступна только в приложении"),
        ),
};
