import { useState } from "react";

import type { Instance } from "./bindings";
import { Rail, type Screen } from "./components/Rail";
import { useDeleteInstance, useInstances } from "./hooks/useInstances";
import { AccountScreen } from "./screens/AccountScreen";
import { InstancesScreen } from "./screens/InstancesScreen";
import { ModsScreen } from "./screens/ModsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SkinsScreen } from "./screens/SkinsScreen";

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
    <div className="flex h-full bg-black">
      <Rail screen={screen} onNavigate={setScreen} />

      {screen === "instances" && (
        <InstancesScreen
          instances={instances}
          isLoading={isLoading}
          isError={isError}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onCreated={handleCreated}
          onDelete={handleDelete}
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

      {screen === "account" && <AccountScreen />}
      {screen === "skins" && <SkinsScreen onNavigate={setScreen} />}
      {screen === "settings" && <SettingsScreen />}
    </div>
  );
}
