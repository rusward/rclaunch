import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";

import type { LaunchProgress } from "../bindings";
import { ipc, isDesktop } from "../lib/ipc";

export type LaunchStatus = "idle" | "preparing" | "running" | "exited" | "error";

export interface LaunchState {
  status: LaunchStatus;
  stage: string;
  progress: LaunchProgress | null;
  logs: string[];
  exitCode: number | null;
  error: string | null;
  instanceName: string | null;
}

const initialState: LaunchState = {
  status: "idle",
  stage: "",
  progress: null,
  logs: [],
  exitCode: null,
  error: null,
  instanceName: null,
};

export function useLaunch() {
  const [state, setState] = useState<LaunchState>(initialState);
  const [open, setOpen] = useState(false);
  const unlisteners = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    let disposed = false;
    const setup = async () => {
      const listeners = await Promise.all([
        listen<string>("launch:stage", (event) =>
          setState((current) => ({
            ...current,
            stage: event.payload,
            status: current.status === "idle" ? "preparing" : current.status,
          })),
        ),
        listen<LaunchProgress>("launch:progress", (event) =>
          setState((current) => ({ ...current, progress: event.payload })),
        ),
        listen<string>("launch:log", (event) =>
          setState((current) => ({
            ...current,
            logs: [...current.logs.slice(-240), event.payload],
          })),
        ),
        listen<string>("launch:started", () =>
          setState((current) => ({ ...current, status: "running" })),
        ),
        listen<number | null>("launch:exited", (event) =>
          setState((current) => ({
            ...current,
            status: "exited",
            exitCode: event.payload,
          })),
        ),
        listen<string>("launch:error", (event) =>
          setState((current) => ({
            ...current,
            status: "error",
            error: event.payload,
          })),
        ),
      ]);

      if (disposed) {
        listeners.forEach((unlisten) => unlisten());
      } else {
        unlisteners.current = listeners;
      }
    };

    void setup();

    return () => {
      disposed = true;
      unlisteners.current.forEach((unlisten) => unlisten());
      unlisteners.current = [];
    };
  }, []);

  const mutation = useMutation({
    mutationFn: (instanceId: string) => ipc.launchInstance(instanceId),
    onSuccess: () =>
      setState((current) =>
        current.status === "error" ? current : { ...current, status: "exited" },
      ),
    onError: (error) =>
      setState((current) => ({
        ...current,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      })),
  });

  const start = (instanceId: string, instanceName: string) => {
    setState({ ...initialState, status: "preparing", instanceName });
    setOpen(true);
    mutation.mutate(instanceId);
  };

  const close = () => {
    if (mutation.isPending) {
      return;
    }
    setOpen(false);
    setState(initialState);
  };

  return {
    ...state,
    open,
    isRunning: mutation.isPending,
    start,
    close,
  };
}
