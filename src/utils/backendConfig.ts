// src/utils/backendConfig.ts
import { BackendInfo } from '../types';

/**
 * @deprecated 此类保留用于向后兼容，建议使用 useBackendStore
 * BackendConfigManager 现在作为 zustand store 的代理
 */
export class BackendConfigManager {
  private static instance: BackendConfigManager;
  private listeners: Array<(info: BackendInfo | null) => void> = [];

  static getInstance(): BackendConfigManager {
    if (!BackendConfigManager.instance) {
      BackendConfigManager.instance = new BackendConfigManager();
    }
    return BackendConfigManager.instance;
  }

  setBackendInfo(info: BackendInfo): void {
    // 获取 zustand store 实例（动态导入避免循环依赖）
    import('../stores/backendStore').then(({ useBackendStore }) => {
      useBackendStore.getState().setBackendInfo(info);
    });
    
    // 触发本地监听器（向后兼容）
    this.listeners.forEach(listener => listener(info));
  }

  getBackendInfo(): BackendInfo | null {
    // 尝试从 zustand store 获取最新数据
    try {
      // 同步获取当前状态（如果 store 已初始化）
      if (typeof window !== 'undefined') {
        const storeState = JSON.parse(
          localStorage.getItem('backend-status-storage') || 'null'
        );
        if (storeState?.state?.backendInfo) {
          return storeState.state.backendInfo;
        }
      }
    } catch (error) {
      console.warn('Failed to get backend info from store:', error);
    }
    
    return null;
  }

  subscribe(listener: (info: BackendInfo | null) => void): () => void {
    this.listeners.push(listener);
    
    // 立即调用一次监听器，传递当前状态
    const currentInfo = this.getBackendInfo();
    if (currentInfo) {
      listener(currentInfo);
    }
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getApiBaseUrl(): string | null {
    const backendInfo = this.getBackendInfo();
    if (!backendInfo) return null;
    console.log(`Using backend API base URL: ${backendInfo.api_base}`);
    return backendInfo.api_base;
  }

  clearBackendInfo(): void {
    // 清除 zustand store
    import('../stores/backendStore').then(({ useBackendStore }) => {
      useBackendStore.getState().clearBackendInfo();
    });
    
    // 触发本地监听器（向后兼容）
    this.listeners.forEach(listener => listener(null));
  }
}
