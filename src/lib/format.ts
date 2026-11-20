import type { VersionType } from "../bindings";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export const versionTypeLabel: Record<VersionType, string> = {
  release: "Релиз",
  snapshot: "Снапшот",
  old_beta: "Beta",
  old_alpha: "Alpha",
};

export const versionTypeBadge: Record<VersionType, string> = {
  release: "bg-emerald-500/10 text-emerald-300",
  snapshot: "bg-amber-500/10 text-amber-300",
  old_beta: "bg-white/5 text-slate-400",
  old_alpha: "bg-white/5 text-slate-400",
};
