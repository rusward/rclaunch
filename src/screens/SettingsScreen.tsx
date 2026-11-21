import { PageHeader } from "../components/PageHeader";
import { useAppInfo } from "../hooks/useVersions";

export function SettingsScreen() {
  const { data } = useAppInfo();

  return (
    <>
      <PageHeader title="Настройки" subtitle="Приложение и окружение" />

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
        <section className="glass-card max-w-xl overflow-hidden rounded-2xl">
          <div className="divide-y divide-white/[0.05]">
            <Row label="Тема" value="Тёмная · Glass" />
            <Row label="Язык" value="Русский" />
            <Row label="Аккаунты" value="Microsoft" />
            <Row label="Java" value="Системная или Temurin" />
            <Row label="Версия" value={data ? `v${data.version}` : "—"} />
            <Row label="Лицензия" value="MIT" />
          </div>
        </section>

        <p className="mt-4 max-w-xl text-[11px] leading-relaxed text-faint">
          rclaunch — лёгкий лаунчер с изолированными инстансами. Настройки RAM,
          разрешения и темы появятся в следующих версиях.
        </p>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-11 items-center justify-between px-4 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
