import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateInstanceRequest } from "../bindings";
import { ipc } from "../lib/ipc";

export function useInstances() {
  return useQuery({
    queryKey: ["instances"],
    queryFn: ipc.instancesList,
    staleTime: Infinity,
  });
}

export function useCreateInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateInstanceRequest) => ipc.instancesCreate(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["instances"] }),
  });
}

export function useDeleteInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipc.instancesDelete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["instances"] }),
  });
}
