import { router } from "@/routes";
import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "react-query";
import { RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { ReactFlowProvider } from "reactflow";
import { BackendStatus } from "./components/BackendStatus";

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
    <Theme appearance="inherit">
      <QueryClientProvider client={queryClient}>
        <BackendStatus>
          <ReactFlowProvider>
            <RouterProvider router={router} />
            <ToastContainer />
          </ReactFlowProvider>
        </BackendStatus>
      </QueryClientProvider>
    </Theme>
  );
}
