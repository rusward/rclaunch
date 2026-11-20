import { Shirt } from "lucide-react";

export function SkinsScreen() {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center border-b border-line px-4">
        <h1 className="text-[13px] font-medium text-white">Скины и плащи</h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Shirt size={30} className="text-faint" strokeWidth={1.4} />
        <p className="text-[12px] text-faint">Доступно после входа</p>
      </div>
    </div>
  );
}
