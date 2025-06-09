// src/hooks/useBackendEvents.ts
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { BackendInfo, BackendErrorEvent } from "../types";
import { useBackendStore } from "../stores/backendStore";

export const useBackendEvents = () => {
  // 使用 zustand store
  const {
    backendInfo,
    backendError,
    isReady,
    setBackendInfo,
    setBackendError,
    clearBackendInfo,
    getApiBaseUrl,
    isDataFresh,
  } = useBackendStore();

  useEffect(() => {
    console.log("useBackendEvents initialized");

    // 监听后端就绪事件
    const unlistenReady = listen<BackendInfo>("backend-ready", (event) => {
      console.log("Backend ready event received:", event.payload);

      // 更新 zustand store（自动持久化到 localStorage）
      setBackendInfo(event.payload);
    });

    // 监听后端错误事件
    const unlistenError = listen<BackendErrorEvent>(
      "backend-error",
      (event) => {
        console.error("Backend error event received:", event.payload.error);
        // 更新 zustand store
        setBackendError(event.payload.error);
      },
    );

    // 清理函数
    return () => {
      unlistenReady.then((unlisten) => unlisten());
      unlistenError.then((unlisten) => unlisten());
    };
  }, []); // 去除依赖，因为 zustand actions 是稳定的

  // 手动刷新方法（保持向后兼容的 API）
  const refreshBackendStatus = () => {
    console.log("Manual refresh requested - clearing backend status");
    clearBackendInfo();
  };

  // 检查数据新鲜度，如果数据过期则标记为未就绪
  const isDataReady = isReady && isDataFresh();

  // 如果数据过期，自动清理
  useEffect(() => {
    if (isReady && !isDataFresh()) {
      console.warn("Backend data is stale, clearing...");
      clearBackendInfo();
    }
  }, [isReady, isDataFresh, clearBackendInfo]);

  return {
    backendInfo,
    backendError,
    isReady: isDataReady, // 使用带新鲜度检查的 ready 状态
    getApiBaseUrl, // 直接使用 store 的方法
    refreshBackendStatus,

    // 额外的调试和管理方法
    isDataFresh: () => isDataFresh(),
    lastUpdateTime: useBackendStore.getState().lastUpdateTime,
  };
};

// 导出 store 的直接访问方法供需要的地方使用
export const getBackendStatus = () => useBackendStore.getState();
export const setBackendStatus = useBackendStore.getState().setBackendInfo;
export const clearBackendStatus = useBackendStore.getState().clearBackendInfo;
