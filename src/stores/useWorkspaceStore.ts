import { FileMeta, WorkspaceConfig, WorkspaceState } from "@/types";
import { FlowNodeData, NodeType } from "@/types/nodes";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
} from "reactflow";
import { create } from "zustand";
import { shallow } from "zustand/shallow";

// 创建Zustand存储库
export const useWorkspaceStore = create<WorkspaceState>()(
  // persist( // Optional: Uncomment to persist part of the state
  (set, get) => ({
    currentWorkspace: null,
    isDirty: false,
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
      // No need to return ID here, it's passed in
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
        console.log(
          "zustand add file to workspace",
          state.currentWorkspace?.id,
          "newFile",
          newFile,
        );
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
              files: state.currentWorkspace.files.filter(
                (f) => f.id !== fileId,
              ),
            },
            isDirty: true,
          };
        }
        return {};
      });
    },

    // --- Flow Node Actions Implementation ---
    addFlowNode: (node) => {
      console.log("zustand add flow node", node);
      set((state) => {
        if (state.currentWorkspace) {
          // Check for duplicate node ID
          if (state.currentWorkspace.flow_nodes.find((n) => n.id === node.id)) {
            return state;
          }
          return {
            currentWorkspace: {
              ...state.currentWorkspace,
              flow_nodes: [...state.currentWorkspace.flow_nodes, node],
            },
            isDirty: true,
          };
        }
        return {};
      });
    },

    createIndexSourceNode: (nodeId, position, label) => {
      console.log("zustand create index source node", nodeId, position, label);
      const newNode: Node<FlowNodeData> = {
        id: nodeId,
        type: NodeType.INDEX_SOURCE,
        position,
        data: {
          id: nodeId,
          label: label || "索引数据源",
        },
      };
      
      set((state) => {
        if (state.currentWorkspace) {
          return {
            currentWorkspace: {
              ...state.currentWorkspace,
              flow_nodes: [...state.currentWorkspace.flow_nodes, newNode],
            },
            isDirty: true,
          };
        }
        return {};
      });
      
      return newNode;
    },

    createSheetSelectorNode: (nodeId: string, position: { x: number; y: number }, label?: string) => {
      console.log("zustand create sheet selector node", nodeId, position, label);
      const newNode: Node<FlowNodeData> = {
        id: nodeId,
        type: NodeType.SHEET_SELECTOR,
        position,
        data: {
          id: nodeId,
          label: label || "工作表选择器",
          mode: "auto_by_index",
        },
      };
      
      set((state) => {
        if (state.currentWorkspace) {
          return {
            currentWorkspace: {
              ...state.currentWorkspace,
              flow_nodes: [...state.currentWorkspace.flow_nodes, newNode],
            },
            isDirty: true,
          };
        }
        return {};
      });
      
      return newNode;
    },

    createRowFilterNode: (nodeId: string, position: { x: number; y: number }, label?: string) => {
      console.log("zustand create row filter node", nodeId, position, label);
      const newNode: Node<FlowNodeData> = {
        id: nodeId,
        type: NodeType.ROW_FILTER,
        position,
        data: {
          id: nodeId,
          label: label || "数据过滤器",
          conditions: [],
        },
      };
      
      set((state) => {
        if (state.currentWorkspace) {
          return {
            currentWorkspace: {
              ...state.currentWorkspace,
              flow_nodes: [...state.currentWorkspace.flow_nodes, newNode],
            },
            isDirty: true,
          };
        }
        return {};
      });
      
      return newNode;
    },

    createRowLookupNode: (nodeId: string, position: { x: number; y: number }, label?: string) => {
      console.log("zustand create row lookup node", nodeId, position, label);
      const newNode: Node<FlowNodeData> = {
        id: nodeId,
        type: NodeType.ROW_LOOKUP,
        position,
        data: {
          id: nodeId,
          label: label || "数据查找器",
        },
      };
      
      set((state) => {
        if (state.currentWorkspace) {
          return {
            currentWorkspace: {
              ...state.currentWorkspace,
              flow_nodes: [...state.currentWorkspace.flow_nodes, newNode],
            },
            isDirty: true,
          };
        }
        return {};
      });
      
      return newNode;
    },

    createAggregatorNode: (nodeId: string, position: { x: number; y: number }, label?: string) => {
      console.log("zustand create aggregator node", nodeId, position, label);
      const newNode: Node<FlowNodeData> = {
        id: nodeId,
        type: NodeType.AGGREGATOR,
        position,
        data: {
          id: nodeId,
          label: label || "数据聚合器",
          method: "sum",
        },
      };
      
      set((state) => {
        if (state.currentWorkspace) {
          return {
            currentWorkspace: {
              ...state.currentWorkspace,
              flow_nodes: [...state.currentWorkspace.flow_nodes, newNode],
            },
            isDirty: true,
          };
        }
        return {};
      });
      
      return newNode;
    },

    createOutputNode: (nodeId: string, position: { x: number; y: number }, label?: string) => {
      console.log("zustand create output node", nodeId, position, label);
      const newNode: Node<FlowNodeData> = {
        id: nodeId,
        type: NodeType.OUTPUT,
        position,
        data: {
          id: nodeId,
          label: label || "数据输出",
          outputFormat: "table",
        },
      };
      
      set((state) => {
        if (state.currentWorkspace) {
          return {
            currentWorkspace: {
              ...state.currentWorkspace,
              flow_nodes: [...state.currentWorkspace.flow_nodes, newNode],
            },
            isDirty: true,
          };
        }
        return {};
      });
      
      return newNode;
    },

    updateNodeData: (nodeId, data) => {
      console.log("zustand update node data", nodeId, data);
      set((state) => {
        if (state.currentWorkspace) {
          return {
            currentWorkspace: {
              ...state.currentWorkspace,
              flow_nodes: state.currentWorkspace.flow_nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
              ),
            },
            isDirty: true,
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
          return {
            currentWorkspace: {
              ...state.currentWorkspace,
              flow_edges: addEdge(
                connection,
                state.currentWorkspace.flow_edges,
              ),
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
  }),
);

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
  createIndexSourceNode: state.createIndexSourceNode,
  createSheetSelectorNode: state.createSheetSelectorNode,
  createRowFilterNode: state.createRowFilterNode,
  createRowLookupNode: state.createRowLookupNode,
  createAggregatorNode: state.createAggregatorNode,
  createOutputNode: state.createOutputNode,
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
});
