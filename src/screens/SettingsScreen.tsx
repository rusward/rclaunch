import { useAppInfo } from "../hooks/useVersions";

export function SettingsScreen() {
  const { data } = useAppInfo();

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center border-b border-line px-4">
        <h1 className="text-[13px] font-medium text-white">Настройки</h1>
      </header>

      <div className="max-w-lg py-2">
        <Row label="Тема" value="Тёмная" />
        <Row label="Язык" value="Русский" />
        <Row label="Версия" value={data ? `v${data.version}` : "—"} />
        <Row label="Лицензия" value="MIT" />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-line-soft px-4 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
