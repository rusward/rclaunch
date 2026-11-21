import { useState } from "react";

import type { Instance } from "./bindings";
import { Sidebar, type Screen } from "./components/Sidebar";
import { useDeleteInstance, useInstances } from "./hooks/useInstances";
import { InstancesScreen } from "./screens/InstancesScreen";
import { ModsScreen } from "./screens/ModsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

export default function App() {
  const [screen, setScreen] = useState<Screen>("instances");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: instances = [], isLoading, isError } = useInstances();
  const deleteInstance = useDeleteInstance();

  const selected =
    instances.find((instance) => instance.id === selectedId) ??
    instances[0] ??
    null;

  const handleCreated = (instance: Instance) => {
    setSelectedId(instance.id);
    setScreen("instances");
  };

  const handleDelete = (id: string) => {
    deleteInstance.mutate(id);
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  return (
    <div className="app-bg flex h-full p-2.5">
      <div className="glass-shell flex min-h-0 w-full overflow-hidden rounded-[22px]">
        <Sidebar screen={screen} onNavigate={setScreen} />

        <div className="w-px shrink-0 bg-white/[0.07]" />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {screen === "instances" && (
            <InstancesScreen
              instances={instances}
              isLoading={isLoading}
              isError={isError}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              onCreated={handleCreated}
              onDelete={handleDelete}
              onNavigate={setScreen}
            />
          )}

          {screen === "mods" && (
            <ModsScreen
              instances={instances}
              instance={selected}
              onSelectInstance={setSelectedId}
              onNavigate={setScreen}
            />
          )}

          {screen === "profile" && <ProfileScreen onNavigate={setScreen} />}
          {screen === "settings" && <SettingsScreen />}
        </main>
      </div>
    </div>
  );
}
