// src/components/BackendStatus.tsx
import useToast from "@/hooks/useToast";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBackendEvents } from "../hooks/useBackendEvents";

interface BackendStatusProps {
  children: React.ReactNode;
}

export const BackendStatus: React.FC<BackendStatusProps> = ({ children }) => {
  const toast = useToast();
  const { t } = useTranslation();
  const {
    backendInfo,
    backendError,
    isReady,
    getApiBaseUrl,
    checkBackendStatus,
    startBackend,
    restartBackend,
    connectionState,
    lastHeartbeat,
    restartCount,
  } = useBackendEvents();

  // 格式化最后心跳时间
  const formatLastHeartbeat = (timestamp: number | null) => {
    if (!timestamp) return null;
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  const handleRestartBackend = () => {
    restartBackend();
    toast.warning(t("backend.restart_trying") || "重启中...");
  };

  // 获取状态显示文本
  const getStatusText = () => {
    switch (connectionState) {
      case "connecting":
        return t("backend.connecting") || "正在连接后端服务...";
      case "connected":
        return t("backend.connected") || "已连接";
      case "reconnecting":
        return t("backend.reconnecting") || "正在重新连接...";
      case "failed":
        return t("backend.failed") || "连接失败";
      case "disconnected":
      default:
        return t("backend.disconnected") || "未连接";
    }
  };

  // 获取状态颜色
  const getStatusColor = () => {
    switch (connectionState) {
      case "connecting":
      case "reconnecting":
        return "text-blue-600";
      case "connected":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      case "disconnected":
      default:
        return "text-gray-600";
    }
  };

  useEffect(() => {
    if (isReady && backendInfo) {
      console.log(`Backend ready at: ${getApiBaseUrl()}`);
      console.log("Backend info:", backendInfo);
    }
  }, [isReady, backendInfo, getApiBaseUrl]);

  if (backendError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-lg">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              {t("backend.error")}
            </h2>
            <p className="mb-4 text-sm text-gray-600">{backendError}</p>

            {restartCount > 0 && (
              <p className="mb-4 text-xs text-gray-500">
                {t("backend.restart_attempts") || "重启尝试"}: {restartCount}/3
              </p>
            )}

            <div className="space-y-2">
              <button
                onClick={handleRestartBackend}
                className="w-full rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
              >
                {t("backend.restart") || "重启后端"}
              </button>

              <button
                onClick={checkBackendStatus}
                className="w-full rounded-md bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
              >
                {t("backend.check_status") || "检查状态"}
              </button>
            </div>

            <p className="mt-4 text-xs text-gray-500">
              {t("backend.restartApp")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isReady) {
    const showSpinner =
      connectionState === "connecting" || connectionState === "reconnecting";
    const progress =
      connectionState === "connecting"
        ? 60
        : connectionState === "reconnecting"
          ? 80
          : 40;

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-lg">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              {showSpinner ? (
                <svg
                  className="h-6 w-6 animate-spin text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7 12a5 5 0 110-10 5 5 0 010 10z"
                  />
                </svg>
              )}
            </div>

            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              {t("backend.starting")}
            </h2>
            <p className={`mb-4 text-sm ${getStatusColor()}`}>
              {getStatusText()}
            </p>

            {/* 状态详情 */}
            <div className="mb-4 space-y-2">
              {restartCount > 0 && (
                <p className="text-xs text-gray-500">
                  {t("backend.restart_attempts") || "重启尝试"}: {restartCount}
                  /3
                </p>
              )}

              {lastHeartbeat && (
                <p className="text-xs text-gray-500">
                  {t("backend.last_heartbeat") || "最后心跳"}:{" "}
                  {formatLastHeartbeat(lastHeartbeat)}
                </p>
              )}

              {connectionState === "disconnected" && (
                <p className="text-xs text-gray-500">
                  {t("backend.waiting_startup") || "等待启动信号..."}
                </p>
              )}
            </div>

            {/* 进度条 */}
            <div className="mb-4 h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            {/* 操作按钮 */}
            <div className="space-y-2">
              <button
                onClick={checkBackendStatus}
                className="w-full rounded-md bg-blue-100 px-4 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-200"
              >
                {t("backend.check_now") || "立即检查"}
              </button>

              {connectionState === "disconnected" && (
                <button
                  onClick={startBackend}
                  className="w-full rounded-md bg-green-100 px-4 py-2 text-sm text-green-700 transition-colors hover:bg-green-200"
                >
                  {t("backend.start_manual") || "手动启动"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
