import { useMutation, useQuery } from "@tanstack/react-query";

import type { Loader } from "../bindings";
import { ipc } from "../lib/ipc";

export function useModrinthSearch(
  query: string,
  gameVersion: string | null,
  loader: Loader | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["modrinth", query, gameVersion, loader],
    queryFn: () => ipc.modrinthSearch(query, gameVersion, loader),
    staleTime: 60 * 1000,
    retry: 1,
    enabled,
  });
}

export function useInstallMod() {
  return useMutation({
    mutationFn: ({
      instanceId,
      projectId,
    }: {
      instanceId: string;
      projectId: string;
    }) => ipc.modrinthInstall(instanceId, projectId),
  });
}
