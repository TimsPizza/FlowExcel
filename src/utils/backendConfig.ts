// src/utils/backendConfig.ts
import { BackendInfo } from '../types';

export class BackendConfigManager {
  private static instance: BackendConfigManager;
  private backendInfo: BackendInfo | null = null;
  private listeners: Array<(info: BackendInfo | null) => void> = [];

  static getInstance(): BackendConfigManager {
    if (!BackendConfigManager.instance) {
      BackendConfigManager.instance = new BackendConfigManager();
    }
    return BackendConfigManager.instance;
  }

  setBackendInfo(info: BackendInfo): void {
    this.backendInfo = info;
    this.listeners.forEach(listener => listener(info));
  }

  getBackendInfo(): BackendInfo | null {
    return this.backendInfo;
  }

  subscribe(listener: (info: BackendInfo | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getApiBaseUrl(): string | null {
    if (!this.backendInfo) return null;
    console.log(`Using backend API base URL: ${this.backendInfo.api_base}`);
    return this.backendInfo.api_base;
  }

  clearBackendInfo(): void {
    this.backendInfo = null;
    this.listeners.forEach(listener => listener(null));
  }
}
