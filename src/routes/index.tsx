import { FlowEditor } from "@/components/flow/FlowEditor";
import FileLibrary from "@/components/workspace/FileLibrary";
import WorkspaceEditorPage from "@/pages/WorkspaceEditorPage";
import { WorkspaceListPage } from "@/pages/WorkspaceListPage";
import { RouteErrorElement } from "@/routes/ErrorBoundary";
import { createBrowserRouter } from "react-router-dom";

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
