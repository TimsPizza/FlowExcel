import { FileInfo, FileMeta, WorkspaceConfig, WorkspaceState } from "@/types";
import { FlowNodeData } from "@/types/nodes";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  EdgeChange,
  Node,
  NodeChange,
} from "reactflow";
import { create } from "zustand";
import { shallow } from "zustand/shallow";

// 创建Zustand存储库
export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  currentWorkspace: null,
  isDirty: false,
  outdatedFileIds: [],
  // Will set the current workspace to a new workspace with the given id and name
  createWorkspace: (id, name) => {
    // Accept id and optional name
    const newWorkspace: WorkspaceConfig = {
      id: id,
      name: name || `New Workspace ${id.substring(0, 4)}`, // Default name if not provided
      files: [],
      flow_nodes: [],
      flow_edges: [],
    };
    console.log("zustand create workspace");
    set({ currentWorkspace: newWorkspace, isDirty: true });
    return get().currentWorkspace;
  },

  markFileAsOutdated: (fileId: string) => {
    set((state) => {
      // 避免重复添加
      if (state.outdatedFileIds.includes(fileId)) {
        return state;
      }
      return {
        outdatedFileIds: [...state.outdatedFileIds, fileId],
      };
    });
  },

  loadWorkspace: (workspace) => {
    // Ensure flow_nodes and flow_edges are always initialized as an array
    console.log("zustand load workspace");

    set((state) => {
      const current = state.currentWorkspace;
      const sanitized = {
        ...workspace,
        flow_nodes: workspace.flow_nodes || [],
        flow_edges: workspace.flow_edges || [],
      };

      // 如果当前 workspace 已经一样了，就不 set
      if (
        current?.id === sanitized.id &&
        current?.name === sanitized.name &&
        shallow(current?.flow_nodes, sanitized.flow_nodes) &&
        shallow(current?.flow_edges, sanitized.flow_edges)
      ) {
        return state; // won't trigger set
      }

      return {
        currentWorkspace: sanitized,
        isDirty: false,
      };
    });
  },

  setCurrentWorkspaceName: (name) => {
    console.log("zustand set current workspace name", name);
    set((state) => {
      if (state.currentWorkspace) {
        return {
          currentWorkspace: { ...state.currentWorkspace, name },
          isDirty: true,
        };
      }
      return {};
    });
  },

  // Expects a full FileMeta object including a pre-generated id and columns from backend
  addFileToWorkspace: (newFile: FileMeta) => {
    set((state) => {
      // console.log(
      //   "zustand add file to workspace",
      //   state.currentWorkspace?.id,
      //   "newFile",
      //   newFile,
      // );
      if (state.currentWorkspace) {
        // Prevent adding file with duplicate ID (though UUIDs make this unlikely)
        if (state.currentWorkspace.files.find((f) => f.id === newFile.id)) {
          return state;
        }
        return {
          currentWorkspace: {
            ...state.currentWorkspace,
            files: [...state.currentWorkspace.files, newFile],
          },
          isDirty: true,
        };
      }
      return {};
    });
    return get().currentWorkspace;
  },

  updateFileMeta: (fileId, updates) => {
    console.log("zustand update file meta", fileId, updates);
    set((state) => {
      if (state.currentWorkspace) {
        return {
          currentWorkspace: {
            ...state.currentWorkspace,
            files: state.currentWorkspace.files.map((f) =>
              f.id === fileId ? { ...f, ...updates } : f,
            ),
          },
          isDirty: true,
        };
      }
      return {};
    });
  },

  // 更新文件信息为最新, 同时从过时文件列表中移除该文件
  upToDateFileInfo: (fileId: string, newFileInfo: FileInfo) => {
    console.log("zustand up to date file info", fileId, newFileInfo);
    set((state) => {
      if (state.currentWorkspace) {
        return {
          currentWorkspace: {
            ...state.currentWorkspace,
            files: state.currentWorkspace.files.map((f) =>
              f.id === fileId ? { ...f, file_info: newFileInfo } : f,
            ),
          },
          outdatedFileIds: state.outdatedFileIds.filter((id) => id !== fileId),
        };
      }
      return {};
    });
  },

  removeFileFromWorkspace: (fileId) => {
    console.log("zustand remove file from workspace", fileId);
    set((state) => {
      if (state.currentWorkspace) {
        // Also remove nodes that might reference this file?
        // This dependency management can get complex.
        // For now, just remove the file.
        return {
          currentWorkspace: {
            ...state.currentWorkspace,
            files: state.currentWorkspace.files.filter((f) => f.id !== fileId),
          },
          isDirty: true,
          outdatedFileIds: state.outdatedFileIds.filter((id) => id !== fileId),
        };
      }
      return {};
    });
  },

  // --- Flow Node Actions Implementation ---
  addFlowNode: (node: Node<FlowNodeData>) => {
    set((state) => {
      if (state.currentWorkspace) {
        const existingNodeIndex = state.currentWorkspace.flow_nodes.findIndex(
          (n) => n.id === node.id,
        );
        let new_flow_nodes;
        if (existingNodeIndex !== -1) {
          // Node exists, update it (React Flow handles immutable updates well)
          new_flow_nodes = [...state.currentWorkspace.flow_nodes];
          new_flow_nodes[existingNodeIndex] = node;
        } else {
          // Node does not exist, add it
          new_flow_nodes = [...state.currentWorkspace.flow_nodes, node];
        }
        return {
          currentWorkspace: {
            ...state.currentWorkspace,
            flow_nodes: new_flow_nodes,
          },
          isDirty: true,
        };
      }
      return {};
    });
  },

  updateNodeData: (
    nodeId,
    dataToUpdate: Partial<FlowNodeData>,
    markDirty: boolean = false,
  ) => {
    console.log("zustand update node data", nodeId, dataToUpdate);
    set((state) => {
      if (state.currentWorkspace) {
        return {
          currentWorkspace: {
            ...state.currentWorkspace,
            flow_nodes: state.currentWorkspace.flow_nodes.map((n) => {
              if (n.id === nodeId) {
                return {
                  ...n, // Spread top-level ReactFlow node props (id, type, position)
                  // Merge the new partial data directly into the existing node.data
                  data: { ...n.data, ...dataToUpdate } as FlowNodeData,
                };
              }
              return n;
            }),
          },
          isDirty: markDirty,
        };
      }
      return {};
    });
  },

  removeFlowNode: (nodeId) => {
    console.log("zustand remove flow node", nodeId);
    set((state) => {
      if (state.currentWorkspace) {
        return {
          currentWorkspace: {
            ...state.currentWorkspace,
            flow_nodes: state.currentWorkspace.flow_nodes.filter(
              (n) => n.id !== nodeId,
            ),
            // Also remove any edges that connect to/from this node
            flow_edges: state.currentWorkspace.flow_edges.filter(
              (e) => e.source !== nodeId && e.target !== nodeId,
            ),
          },
          isDirty: true,
        };
      }
      return {};
    });
  },
  // Flow Edge Actions Implementation
  removeFlowEdge: (edgeId) => {
    console.log("zustand remove flow edge", edgeId);
    set((state) => {
      if (state.currentWorkspace) {
        return {
          currentWorkspace: {
            ...state.currentWorkspace,
            flow_edges: state.currentWorkspace.flow_edges.filter(
              (e) => e.id !== edgeId,
            ),
          },
          isDirty: true,
        };
      }
      return {};
    });
  },

  onNodesChange: (changes: NodeChange[]) => {
    console.log("zustand on nodes change", changes);
    set((state) => {
      if (state.currentWorkspace?.flow_nodes) {
        return {
          currentWorkspace: {
            ...state.currentWorkspace,
            flow_nodes: applyNodeChanges(
              changes,
              state.currentWorkspace.flow_nodes,
            ),
          },
          isDirty: true,
        };
      }
      return {};
    });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    console.log("zustand on edges change", changes);
    set((state) => {
      if (state.currentWorkspace?.flow_edges) {
        return {
          currentWorkspace: {
            ...state.currentWorkspace,
            flow_edges: applyEdgeChanges(
              changes,
              state.currentWorkspace.flow_edges,
            ),
          },
          isDirty: true,
        };
      }
      return {};
    });
  },

  onConnect: (connection: Connection) => {
    console.log("zustand on connect", connection);
    set((state) => {
      if (state.currentWorkspace?.flow_edges) {
        // 添加一个唯一ID给边
        const edge = {
          ...connection,
          id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
        };
        return {
          currentWorkspace: {
            ...state.currentWorkspace,
            flow_edges: addEdge(edge, state.currentWorkspace.flow_edges),
          },
          isDirty: true,
        };
      }
      return {};
    });
  },

  clearCurrentWorkspace: () => {
    console.log("zustand clear current workspace");
    set({ currentWorkspace: null, isDirty: false });
  },

  resetDirty: () => {
    console.log("zustand reset dirty");
    set({ isDirty: false });
  },

  markAsDirty: () => {
    console.log("zustand mark as dirty");
    set({ isDirty: true });
  },
}));

// 导出稳定的selector函数
export const workspaceSelector = (state: WorkspaceState) => ({
  currentWorkspace: state.currentWorkspace,
  isDirty: state.isDirty,
  loadWorkspace: state.loadWorkspace,
  setCurrentWorkspaceName: state.setCurrentWorkspaceName,
  resetDirty: state.resetDirty,
  clearCurrentWorkspace: state.clearCurrentWorkspace,
});

// 导出稳定的selector函数
export const flowSelector = (state: WorkspaceState) => ({
  flowNodes: state.currentWorkspace?.flow_nodes,
  flowEdges: state.currentWorkspace?.flow_edges,
  addFlowNode: state.addFlowNode,
  updateNodeData: state.updateNodeData,
  removeFlowNode: state.removeFlowNode,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
});

export const fileSelector = (state: WorkspaceState) => ({
  files: state.currentWorkspace?.files,
  addFileToWorkspace: state.addFileToWorkspace,
  updateFileMeta: state.updateFileMeta,
  removeFileFromWorkspace: state.removeFileFromWorkspace,
  upToDateFileInfo: state.upToDateFileInfo,
  markFileAsOutdated: state.markFileAsOutdated,
  outdatedFileIds: state.outdatedFileIds,
});
