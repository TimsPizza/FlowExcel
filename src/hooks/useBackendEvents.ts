// src/hooks/useBackendEvents.ts
import { useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { listen } from '@tauri-apps/api/event';
import { BackendConfigManager } from '../utils/backendConfig';
import { BackendInfo, BackendErrorEvent } from '../types';

// Query keys for React Query
const BACKEND_QUERY_KEY = ['backend-status'];

// Backend status interface
interface BackendStatus {
  backendInfo: BackendInfo | null;
  backendError: string | null;
  isReady: boolean;
}

// Initial backend status
const initialBackendStatus: BackendStatus = {
  backendInfo: null,
  backendError: null,
  isReady: false,
};

export const useBackendEvents = () => {
  const queryClient = useQueryClient();
  
  const { data: backendStatus } = useQuery(
    BACKEND_QUERY_KEY,
    () => {
      // 从 BackendConfigManager 获取初始状态
      const configManager = BackendConfigManager.getInstance();
      const currentInfo = configManager.getBackendInfo();
      
      return {
        backendInfo: currentInfo,
        backendError: null,
        isReady: !!currentInfo,
      } as BackendStatus;
    },
    {
      // 配置缓存策略：状态永不过期，只有在收到事件时才更新
      staleTime: Infinity,
      cacheTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );

  // 更新后端状态的辅助函数
  const updateBackendStatus = (updater: (current: BackendStatus) => BackendStatus) => {
    queryClient.setQueryData(BACKEND_QUERY_KEY, (oldData: BackendStatus | undefined) => {
      const currentData = oldData || initialBackendStatus;
      const newData = updater(currentData);
      
      // 只有状态真正发生变化时才更新
      if (JSON.stringify(currentData) !== JSON.stringify(newData)) {
        console.log('Backend status updated:', newData);
        return newData;
      }
      
      return currentData;
    });
  };

  useEffect(() => {
    console.log("useBackendEvents initialized");
    const configManager = BackendConfigManager.getInstance();

    // 监听后端就绪事件
    const unlistenReady = listen<BackendInfo>('backend-ready', (event) => {
      console.log('Backend ready:', event.payload);
      
      // 更新 BackendConfigManager
      configManager.setBackendInfo(event.payload);
      
      // 更新 React Query 状态
      updateBackendStatus((current) => ({
        backendInfo: event.payload,
        backendError: null,
        isReady: true,
      }));
    });

    // 监听后端错误事件
    const unlistenError = listen<BackendErrorEvent>('backend-error', (event) => {
      console.error('Backend error:', event.payload.error);
      
      // 更新 BackendConfigManager
      configManager.clearBackendInfo();
      
      // 更新 React Query 状态
      updateBackendStatus((current) => ({
        backendInfo: null,
        backendError: event.payload.error,
        isReady: false,
      }));
    });

    // 订阅配置变化（用于同步其他地方的更改）
    const unsubscribe = configManager.subscribe((info) => {
      updateBackendStatus((current) => ({
        ...current,
        backendInfo: info,
        isReady: !!info,
      }));
    });

    // 清理函数
    return () => {
      unlistenReady.then(unlisten => unlisten());
      unlistenError.then(unlisten => unlisten());
      unsubscribe();
    };
  }, [queryClient]);

  return {
    backendInfo: backendStatus?.backendInfo || null,
    backendError: backendStatus?.backendError || null,
    isReady: backendStatus?.isReady || false,
    getApiBaseUrl: () => BackendConfigManager.getInstance().getApiBaseUrl(),
    // 提供手动刷新状态的方法
    refreshBackendStatus: () => {
      queryClient.invalidateQueries({ queryKey: BACKEND_QUERY_KEY });
    },
  };
};

// 用于在组件外部更新后端状态的工具函数
export const updateBackendStatusExternal = (
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (current: BackendStatus) => BackendStatus
) => {
  queryClient.setQueryData(BACKEND_QUERY_KEY, (oldData: BackendStatus | undefined) => {
    const currentData = oldData || initialBackendStatus;
    return updater(currentData);
  });
};

// 导出类型和查询键供其他地方使用
export type { BackendStatus };
export { BACKEND_QUERY_KEY };
