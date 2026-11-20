import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";

import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { VersionDetails } from "./components/VersionDetails";
import { VersionList } from "./components/VersionList";
import type { VersionFilter } from "./components/VersionList";
import { useVersions } from "./hooks/useVersions";

export default function App() {
  const { data, isLoading, isError, isFetching, error, refetch } =
    useVersions();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VersionFilter>("release");

  const versions = data?.versions ?? [];
  const latestRelease = data?.latest.release;

  const visibleVersions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return versions.filter((version) => {
      if (filter !== "all" && version.type !== filter) {
        return false;
      }
      return (
        normalized.length === 0 ||
        version.id.toLowerCase().includes(normalized)
      );
    });
  }, [versions, filter, query]);

  const selected = useMemo(() => {
    return (
      visibleVersions.find((version) => version.id === selectedId) ??
      visibleVersions[0] ??
      null
    );
  }, [visibleVersions, selectedId]);

  const errorMessage =
    error instanceof Error ? error.message : error ? String(error) : undefined;

  return (
    <div className="relative flex h-full overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/3 h-[34rem] w-[34rem] rounded-full bg-brand-600/15 blur-[130px]" />
        <div className="absolute -bottom-56 right-[8%] h-[30rem] w-[30rem] rounded-full bg-brand-900/30 blur-[130px]" />
      </div>

      <Sidebar />

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Библиотека версий
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Официальный манифест Mojang
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск версии…"
                spellCheck={false}
                className="w-60 rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-brand-500/50 focus:bg-white/[0.07]"
              />
            </div>

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Обновить манифест"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw
                size={15}
                className={isFetching ? "animate-spin" : undefined}
              />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <VersionList
            versions={visibleVersions}
            latestRelease={latestRelease}
            selectedId={selected?.id}
            filter={filter}
            isLoading={isLoading}
            isError={isError}
            errorMessage={errorMessage}
            onFilterChange={setFilter}
            onSelect={setSelectedId}
            onRetry={() => refetch()}
          />
          <VersionDetails version={selected} latestRelease={latestRelease} />
        </div>

        <StatusBar
          isLoading={isLoading}
          isError={isError}
          count={versions.length}
        />
      </main>
    </div>
  );
}
