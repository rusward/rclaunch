import { useQuery } from "@tanstack/react-query";

import { ipc } from "../lib/ipc";

export function useVersions() {
  return useQuery({
    queryKey: ["versions"],
    queryFn: ipc.versionsManifest,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useAppInfo() {
  return useQuery({
    queryKey: ["app-info"],
    queryFn: ipc.appInfo,
    staleTime: Infinity,
  });
}
