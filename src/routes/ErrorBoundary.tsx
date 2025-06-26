import React from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import {
  Box,
  Card,
  Flex,
  Text,
  Button,
  Heading,
  Separator,
} from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { useNavigate, useRouteError } from "react-router-dom";
import {
  ExclamationTriangleIcon,
  HomeIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDevelopment = import.meta.env.DEV;

  const handleGoHome = () => {
    navigate("/");
    resetErrorBoundary();
  };

  return (
    <Box className="bg-surface fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <Card size="3" className="w-full max-w-lg">
        <Flex direction="column" className="gap-4 p-5">
          {/* Header */}
          <Flex direction="column" className="items-center gap-3">
            <Box className="bg-red-3 rounded-full p-3">
              <ExclamationTriangleIcon
                width={24}
                height={24}
                className="text-red-11"
              />
            </Box>

            <Heading size="5" className="text-center">
              {t("common.error", "Something went wrong")}
            </Heading>

            <Text size="2" className="text-gray-6 text-center">
              {t(
                "errorBoundary.description",
                "An unexpected error occurred. Please try again or return to the homepage.",
              )}
            </Text>
          </Flex>

          <Separator size="4" className="my-4" />

          {/* Error Details for Dev */}
          {isDevelopment && (
            <Box className="bg-red-2 border-red-6 rounded-md border p-4">
              <Text size="2" weight="bold" className="text-red-11 mb-2">
                {t("errorBoundary.devDetails", "Development Error Details:")}
              </Text>
              <Box className="bg-surface max-h-32 overflow-auto rounded p-2">
                <Text
                  size="1"
                  className="text-red-11 whitespace-pre-wrap font-mono"
                >
                  {error.message}
                </Text>
              </Box>
              {error.stack && (
                <details className="mt-2">
                  <summary className="text-red-11 cursor-pointer text-xs">
                    {t("errorBoundary.stackTrace", "Stack trace")}
                  </summary>
                  <Box className="bg-surface mt-1 max-h-40 overflow-auto rounded p-2">
                    <Text
                      size="1"
                      className="text-red-11 whitespace-pre-wrap font-mono"
                    >
                      {error.stack}
                    </Text>
                  </Box>
                </details>
              )}
            </Box>
          )}

          {/* Actions */}
          <Flex direction={{ initial: "column", sm: "row" }} className="gap-3">
            <Button onClick={resetErrorBoundary} size="3" className="flex-1">
              <ReloadIcon width={16} height={16} />
              {t("common.retry", "Try Again")}
            </Button>
            <Button
              onClick={handleGoHome}
              size="3"
              variant="outline"
              className="flex-1"
            >
              <HomeIcon width={16} height={16} />
              {t("errorBoundary.goHome", "Go Home")}
            </Button>
          </Flex>

          <Separator size="4" className="my-4" />

          {/* Support Text */}
          <Text size="1" className="text-gray-6 text-center">
            {t(
              "errorBoundary.contact",
              "If this problem persists, please contact support.",
            )}
          </Text>
        </Flex>
      </Card>
    </Box>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={fallback || ErrorFallback}
      onError={(error, errorInfo) => {
        console.error("🔥 Error caught by boundary:", error, errorInfo);
      }}
      onReset={() => window.location.reload()}
    >
      {children}
    </ReactErrorBoundary>
  );
}

export default ErrorBoundary;

export function RouteErrorElement() {
  const error = useRouteError();
  const navigate = useNavigate();
  const reset = () => navigate("/", { replace: true });

  return (
    <ErrorFallback
      error={(error as Error) ?? new Error("Unknown route error")}
      resetErrorBoundary={reset}
    />
  );
}
