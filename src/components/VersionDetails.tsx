import type { ReactNode } from "react";
import {
  CalendarDays,
  Check,
  Circle,
  Coffee,
  HardDriveDownload,
  Play,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { VersionEntry } from "../bindings";
import { formatDate, versionTypeLabel } from "../lib/format";

interface VersionDetailsProps {
  version: VersionEntry | null;
  latestRelease?: string;
}

export function VersionDetails({ version, latestRelease }: VersionDetailsProps) {
  if (!version) {
    return (
      <aside className="flex min-w-0 flex-1 flex-col items-center justify-center p-8 text-center">
        <img
          src="/logo.png"
          alt=""
          className="h-24 w-24 opacity-30"
          draggable={false}
        />
        <p className="mt-5 text-sm text-slate-400">Выбери версию слева</p>
      </aside>
    );
  }

  return (
    <aside className="flex min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-brand-500/20 bg-linear-to-br from-brand-600/20 to-brand-900/10">
            <img
              src="/logo.png"
              alt=""
              className="h-11 w-11 object-contain"
              draggable={false}
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand-400">
              {versionTypeLabel[version.type]}
            </p>
            <h2 className="mt-1 break-words text-2xl font-semibold tracking-tight text-white xl:text-3xl">
              {version.id}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {version.id === latestRelease
                ? "Последний стабильный релиз"
                : `Выпущена ${formatDate(version.releaseTime)}`}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
          <InfoCard
            icon={Tag}
            label="Тип"
            value={versionTypeLabel[version.type]}
          />
          <InfoCard
            icon={CalendarDays}
            label="Дата релиза"
            value={formatDate(version.releaseTime)}
          />
          <InfoCard icon={HardDriveDownload} label="Загрузка" value="—" />
          <InfoCard
            icon={Coffee}
            label="Java"
            value="подберём автоматически"
          />
        </div>

        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
            Путь до запуска
          </div>
          <ul className="mt-3 space-y-2.5 text-sm">
            <PipelineStep done>Манифест версий</PipelineStep>
            <PipelineStep>Клиент и библиотеки</PipelineStep>
            <PipelineStep>Ассеты</PipelineStep>
            <PipelineStep>Java и запуск игры</PipelineStep>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5 px-6 py-4">
        <button
          type="button"
          disabled
          title="Установка и запуск — следующий шаг"
          className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-linear-to-r from-brand-500 to-brand-700 py-3.5 text-sm font-semibold text-white/90 opacity-60"
        >
          <Play size={16} fill="currentColor" />
          Играть
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          Установка и запуск появятся на следующем шаге
        </p>
      </div>
    </aside>
  );
}

interface InfoCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

function InfoCard({ icon: Icon, label, value }: InfoCardProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500">
        <Icon size={12} />
        {label}
      </div>
      <div
        className="mt-1 text-sm leading-snug text-slate-200"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function PipelineStep({
  done = false,
  children,
}: {
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={
          done
            ? "flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
            : "flex h-4 w-4 items-center justify-center text-slate-600"
        }
      >
        {done ? <Check size={11} strokeWidth={3} /> : <Circle size={7} />}
      </span>
      <span className={done ? "text-slate-300" : "text-slate-500"}>
        {children}
      </span>
    </li>
  );
}
