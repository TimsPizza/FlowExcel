import { createBrowserRouter } from "react-router-dom";
import { WorkspaceListPage } from "@/pages/WorkspaceListPage";
import WorkspaceEditorPage from "@/pages/WorkspaceEditorPage";
import FileLibrary from "@/components/workspace/FileLibrary";
import { FlowEditor } from "@/components/flow/FlowEditor";
import ErrorBoundary, { RouteErrorElement } from "@/routes/ErrorBoundary";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <WorkspaceListPage />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: "/workspace/:workspaceId",
    element: <WorkspaceEditorPage />,
    errorElement: <RouteErrorElement />,

    children: [
      {
        path: "files-manager",
        element: <FileLibrary />,
        errorElement: <RouteErrorElement />,
      },
      {
        path: "flow-editor",
        element: <FlowEditor />,
        errorElement: <RouteErrorElement />,
      },
    ],
  },
  {
    path: "*",
    element: <WorkspaceListPage />,
    errorElement: <RouteErrorElement />,
  },
]);
