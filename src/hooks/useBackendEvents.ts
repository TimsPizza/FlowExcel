// src/hooks/useBackendEvents.ts
import { useBackendStore } from "@/stores/useBackendStore";
import { BackendInfo, BackendStatus } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

export const useBackendEvents = () => {
  // 使用 zustand store
  const {
    backendInfo,
    backendError,
    isReady,
    setBackendInfo,
    setBackendError,
    getApiBaseUrl,
    isDataFresh,
  } = useBackendStore();

  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected" | "reconnecting" | "failed"
  >("disconnected");
  const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null);
  const [restartCount, setRestartCount] = useState(0);

  // 主动检查后端状态
  const checkBackendStatus = useCallback(async () => {
    try {
      const status = await invoke<BackendStatus>("get_backend_status");
      console.log("Backend status:", status);

      // 更新本地状态
      setRestartCount(status.restart_count);
      setLastHeartbeat(status.last_heartbeat || null);

      // 处理不同的状态
      if (typeof status.state === "object" && "Running" in status.state) {
        const backendInfo = status.state.Running;
        setBackendInfo(backendInfo);
        setConnectionState("connected");
        return backendInfo;
      } else if (status.state === "Starting") {
        setConnectionState("connecting");
        return null;
      } else if (status.state === "Restarting") {
        setConnectionState("reconnecting");
        return null;
      } else if (typeof status.state === "object" && "Failed" in status.state) {
        setBackendError(status.state.Failed);
        setConnectionState("failed");
        return null;
      } else {
        // NotStarted
        setConnectionState("disconnected");
        return null;
      }
    } catch (error) {
      console.debug("Backend status check failed:", error);
      setConnectionState("disconnected");
      return null;
    }
  }, [setBackendInfo, setBackendError]);

  // 启动后端
  const startBackend = useCallback(async () => {
    try {
      setConnectionState("connecting");
      await invoke("start_backend");
      console.log("Backend start requested");
    } catch (error) {
      console.error("Failed to start backend:", error);
      setBackendError(error as string);
      setConnectionState("failed");
    }
  }, [setBackendError]);

  // 重启后端
  const restartBackend = useCallback(async () => {
    try {
      setConnectionState("reconnecting");
      await invoke("restart_backend");
      console.log("Backend restart requested");
    } catch (error) {
      console.error("Failed to restart backend:", error);
      setBackendError(error as string);
      setConnectionState("failed");
    }
  }, [setBackendError]);

  // 初始化时检查状态并启动后端
  const initializeBackend = useCallback(async () => {
    console.log("Initializing backend...");

    // 首先检查当前状态
    const currentInfo = await checkBackendStatus();

    if (!currentInfo) {
      // 如果后端未运行，启动它
      console.log("Backend not running, starting...");
      await startBackend();
    } else {
      console.log("Backend already running");
    }
  }, [checkBackendStatus, startBackend]);

  useEffect(() => {
    console.log("useBackendEvents initialized");

    // 监听后端就绪事件
    const unlistenReady = listen<BackendInfo>("backend-ready", (event) => {
      console.log("Backend ready event received:", event.payload);
      setBackendInfo(event.payload);
      setConnectionState("connected");
    });

    // 监听后端状态变化事件
    const unlistenStatusChange = listen<BackendStatus>(
      "backend-status-changed",
      (event) => {
        console.log("Backend status changed:", event.payload);

        const status = event.payload;
        setRestartCount(status.restart_count);
        setLastHeartbeat(status.last_heartbeat || null);

        if (typeof status.state === "object" && "Running" in status.state) {
          const backendInfo = status.state.Running;
          setBackendInfo(backendInfo);
          setConnectionState("connected");
        } else if (status.state === "Starting") {
          setConnectionState("connecting");
        } else if (status.state === "Restarting") {
          setConnectionState("reconnecting");
        } else if (
          typeof status.state === "object" &&
          "Failed" in status.state
        ) {
          setBackendError(status.state.Failed);
          setConnectionState("failed");
        } else {
          // NotStarted
          setConnectionState("disconnected");
        }
      },
    );

    // 初始化后端
    initializeBackend();

    // 清理函数
    return () => {
      unlistenReady.then((unlisten) => unlisten());
      unlistenStatusChange.then((unlisten) => unlisten());
    };
  }, [initializeBackend, setBackendInfo, setBackendError]);

  // 手动刷新方法
  const refreshBackendStatus = useCallback(async () => {
    console.log("Manual refresh requested");
    await checkBackendStatus();
  }, [checkBackendStatus]);

  // 检查数据新鲜度
  const isDataReady = isReady && isDataFresh();

  return {
    backendInfo,
    backendError,
    isReady: isDataReady,
    getApiBaseUrl,
    refreshBackendStatus,
    checkBackendStatus,
    startBackend,
    restartBackend,

    // 新增的状态信息
    connectionState,
    lastHeartbeat,
    restartCount,

    // 额外的调试和管理方法
    isDataFresh: () => isDataFresh(),
    lastUpdateTime: useBackendStore.getState().lastUpdateTime,
  };
};

// 导出 store 的直接访问方法供需要的地方使用
export const getBackendStatus = () => useBackendStore.getState();
export const setBackendStatus = useBackendStore.getState().setBackendInfo;
export const clearBackendStatus = useBackendStore.getState().clearBackendInfo;
