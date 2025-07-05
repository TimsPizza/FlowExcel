import { router } from "@/routes";
import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "react-query";
import { RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { ReactFlowProvider } from "reactflow";
import { BackendStatus } from "./components/BackendStatus";
import { ErrorBoundary } from "@/routes/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 0,
      cacheTime: 0,
      retry: false,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <Theme appearance="inherit">
        <QueryClientProvider client={queryClient}>
          <BackendStatus>
            <ReactFlowProvider>
              <RouterProvider router={router} />
            </ReactFlowProvider>
          </BackendStatus>
          <ToastContainer />
        </QueryClientProvider>
      </Theme>
    </ErrorBoundary>
  );
}
