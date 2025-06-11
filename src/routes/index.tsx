import { createBrowserRouter } from "react-router-dom";
import { WorkspaceListPage } from "@/pages/WorkspaceListPage";
import WorkspaceEditorPage from "@/pages/WorkspaceEditorPage";
import FileLibrary from "@/components/workspace/FileLibrary";
import { FlowEditor } from "@/components/flow/FlowEditor";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <WorkspaceListPage />,
  },
  {
    path: "/workspace/:workspaceId",
    element: <WorkspaceEditorPage />,
    children: [
      {
        path: "files-manager",
        element: <FileLibrary />,
      },
      {
        path: "flow-editor",
        element: <FlowEditor />,
      },
    ],
  },
  {
    path: "*",
    element: <WorkspaceListPage />,
  },
]);
