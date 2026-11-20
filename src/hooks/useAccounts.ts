import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ipc } from "../lib/ipc";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: ipc.authAccounts,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ipc.authLogin,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useSetActiveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipc.authSetActive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useLogoutAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipc.authLogout(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });
}
