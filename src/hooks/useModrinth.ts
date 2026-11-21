import { useMutation, useQuery } from "@tanstack/react-query";

import type { Loader, ProjectType } from "../bindings";
import { ipc } from "../lib/ipc";

export function useProjectSearch(
  query: string,
  gameVersion: string | null,
  loader: Loader | null,
  projectType: ProjectType,
  enabled = true,
) {
  return useQuery({
    queryKey: ["modrinth", projectType, query, gameVersion, loader],
    queryFn: () =>
      ipc.modrinthSearch(query, gameVersion, loader, projectType),
    staleTime: 60 * 1000,
    retry: 1,
    enabled,
  });
}

export function useInstallProject() {
  return useMutation({
    mutationFn: ({
      instanceId,
      projectId,
      projectType,
    }: {
      instanceId: string;
      projectId: string;
      projectType: ProjectType;
    }) => ipc.modrinthInstall(instanceId, projectId, projectType),
  });
}
