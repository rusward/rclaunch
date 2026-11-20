import { ImagePlus, Shirt } from "lucide-react";

import type { Screen } from "../components/Rail";
import { SkinPreview } from "../components/SkinPreview";
import { useAccounts } from "../hooks/useAccounts";

interface SkinsScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function SkinsScreen({ onNavigate }: SkinsScreenProps) {
  const { data } = useAccounts();
  const account =
    data?.accounts.find((item) => item.id === data.activeId) ??
    data?.accounts[0] ??
    null;

  const skin =
    account?.skins.find((item) => item.state === "ACTIVE") ??
    account?.skins[0] ??
    null;
  const cape =
    account?.capes.find((item) => item.state === "ACTIVE") ??
    account?.capes[0] ??
    null;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <h1 className="text-[13px] font-medium text-white">Скины и плащи</h1>
        {account && (
          <span className="text-[11px] text-faint">{account.name}</span>
        )}
      </header>

      {!account ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Shirt size={30} className="text-faint" strokeWidth={1.4} />
          <p className="text-[12px] text-faint">Доступно после входа</p>
          <button
            type="button"
            onClick={() => onNavigate("account")}
            className="h-8 rounded-md bg-accent-600 px-3 text-[12px] font-medium text-white transition-colors duration-100 hover:bg-accent-500"
          >
            Аккаунт
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-start gap-8 overflow-y-auto p-6">
          <div className="flex h-[260px] w-[180px] shrink-0 items-center justify-center rounded-lg border border-line bg-panel">
            <SkinPreview skin={skin} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold text-white">
              {account.name}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              {skin?.variant === "SLIM" ? "Slim" : "Classic"}
              {skin?.alias ? ` · ${skin.alias}` : ""}
            </p>

            <div className="mt-6">
              <span className="text-[10px] uppercase tracking-wide text-faint">
                Плащ
              </span>
              <div className="mt-2 flex h-24 w-48 items-center justify-center rounded-lg border border-line bg-panel">
                {cape?.url ? (
                  <img
                    src={cape.url}
                    alt=""
                    className="h-16 w-32 object-contain [image-rendering:pixelated]"
                  />
                ) : (
                  <span className="text-[11px] text-faint">Нет плаща</span>
                )}
              </div>
              {cape?.alias && (
                <p className="mt-1.5 text-[11px] text-muted">{cape.alias}</p>
              )}
            </div>

            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                disabled
                title="Загрузка скина — следующий шаг"
                className="flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md bg-white/[0.06] px-3 text-[12px] text-white opacity-50"
              >
                <ImagePlus size={14} />
                Скин
              </button>
              <button
                type="button"
                disabled
                title="Выбор плаща — следующий шаг"
                className="flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md bg-white/[0.06] px-3 text-[12px] text-white opacity-50"
              >
                <Shirt size={14} />
                Плащ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
