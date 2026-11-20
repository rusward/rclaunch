import { invoke } from "@tauri-apps/api/core";

import type { AppInfo, VersionManifest } from "../bindings";

const MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

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
};
