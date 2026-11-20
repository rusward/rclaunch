import type { Loader, VersionType } from "../bindings";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function formatRelative(timestamp: number | null): string {
  if (!timestamp) {
    return "—";
  }

  const diff = Date.now() - timestamp;
  const day = 86_400_000;

  if (diff < day) {
    return "сегодня";
  }
  if (diff < 2 * day) {
    return "вчера";
  }
  if (diff < 30 * day) {
    return `${Math.floor(diff / day)} дн.`;
  }
  if (diff < 365 * day) {
    return `${Math.floor(diff / (30 * day))} мес.`;
  }
  return `${Math.floor(diff / (365 * day))} г.`;
}

export function formatDownloads(downloads: number): string {
  if (downloads >= 1_000_000_000) {
    return `${(downloads / 1_000_000_000).toFixed(1)}B`;
  }
  if (downloads >= 1_000_000) {
    return `${(downloads / 1_000_000).toFixed(1)}M`;
  }
  if (downloads >= 1_000) {
    return `${Math.round(downloads / 1_000)}K`;
  }
  return String(downloads);
}

export const versionTypeLabel: Record<VersionType, string> = {
  release: "release",
  snapshot: "snapshot",
  old_beta: "beta",
  old_alpha: "alpha",
};

export const loaderLabel: Record<Loader, string> = {
  vanilla: "Vanilla",
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
};
