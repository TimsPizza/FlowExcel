// src/components/BackendStatus.tsx
import { useBackendEvents } from '../hooks/useBackendEvents';
import { useEffect } from 'react';

interface BackendStatusProps {
  children: React.ReactNode;
}

export const BackendStatus: React.FC<BackendStatusProps> = ({ children }) => {
  const { backendInfo, backendError, isReady, getApiBaseUrl } = useBackendEvents();

  useEffect(() => {
    if (isReady && backendInfo) {
      console.log(`Backend ready at: ${getApiBaseUrl()}`);
    console.log('Backend info:', backendInfo);
    }
  }, [isReady, backendInfo, getApiBaseUrl]);

  if (backendError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-red-200">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">后端服务错误</h2>
            <p className="text-sm text-gray-600 mb-4">{backendError}</p>
            <p className="text-xs text-gray-500">请重新启动应用程序</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="animate-spin w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">正在启动后端服务</h2>
            <p className="text-sm text-gray-600 mb-4">请稍候，后端服务正在初始化...</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
