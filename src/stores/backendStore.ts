import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BackendInfo } from '../types';

interface BackendState {
  // 状态数据
  backendInfo: BackendInfo | null;
  backendError: string | null;
  isReady: boolean;
  lastUpdateTime: number;
  
  // Actions
  setBackendInfo: (info: BackendInfo) => void;
  setBackendError: (error: string) => void;
  clearBackendInfo: () => void;
  clearError: () => void;
  
  // 工具方法
  getApiBaseUrl: () => string;
  isDataFresh: (maxAgeMs?: number) => boolean;
}

export const useBackendStore = create<BackendState>()(
  persist(
    (set, get) => ({
      // 初始状态
      backendInfo: null,
      backendError: null,
      isReady: false,
      lastUpdateTime: 0,
      
      // Actions
      setBackendInfo: (info: BackendInfo) => {
        set({
          backendInfo: info,
          backendError: null, // 清除之前的错误
          isReady: true,
          lastUpdateTime: Date.now(),
        });
        console.log('Backend info updated:', info);
      },
      
      setBackendError: (error: string) => {
        set({
          backendInfo: null,
          backendError: error,
          isReady: false,
          lastUpdateTime: Date.now(),
        });
        console.error('Backend error set:', error);
      },
      
      clearBackendInfo: () => {
        set({
          backendInfo: null,
          backendError: null,
          isReady: false,
          lastUpdateTime: Date.now(),
        });
        console.log('Backend info cleared');
      },
      
      clearError: () => {
        set({ backendError: null });
      },
      
      // 工具方法
      getApiBaseUrl: () => {
        const { backendInfo } = get();
        return backendInfo?.api_base || '';
      },
      
      isDataFresh: (maxAgeMs = 24 * 60 * 60 * 1000) => { // 默认24小时
        const { lastUpdateTime } = get();
        return Date.now() - lastUpdateTime < maxAgeMs;
      },
    }),
    {
      name: 'backend-status-storage', // localStorage key
      version: 1,
      // 只持久化必要的字段
      partialize: (state) => ({
        backendInfo: state.backendInfo,
        backendError: state.backendError,
        isReady: state.isReady,
        lastUpdateTime: state.lastUpdateTime,
      }),
      // 迁移逻辑（为未来版本升级准备）
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // 从版本0迁移到版本1的逻辑
          return {
            ...persistedState,
            lastUpdateTime: Date.now(),
          };
        }
        return persistedState as BackendState;
      },
      // 合并策略：恢复时与默认状态合并
      merge: (persistedState: any, currentState: BackendState) => ({
        ...currentState,
        ...persistedState,
      }),
    }
  )
);

// 开发环境调试支持
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__BACKEND_STORE__ = useBackendStore;
}

// 导出类型供其他地方使用
export type { BackendState }; 