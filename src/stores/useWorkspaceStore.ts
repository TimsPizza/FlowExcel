import { FileMeta, WorkspaceConfig, WorkspaceState } from "@/types";
import {
  FlowNodeData,
  NodeType,
  IndexSourceNodeDataContext,
  SheetSelectorNodeDataContext,
  RowFilterNodeDataContext,
  RowLookupNodeDataContext,
  AggregatorNodeDataContext,
  OutputNodeDataContext,
} from "@/types/nodes";
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
export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
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
    return get().currentWorkspace;
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
            files: state.currentWorkspace.files.filter((f) => f.id !== fileId),
          },
          isDirty: true,
        };
      }
      return {};
    });
  },

  // --- Flow Node Actions Implementation ---
  addFlowNode: (node: Node<FlowNodeData>) => {
    console.log("zustand add flow node", node);
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

  createIndexSourceNode: (nodeId, position, label) => {
    const newNodeData: IndexSourceNodeDataContext = {
      nodeType: NodeType.INDEX_SOURCE,
      label: label || "索引源",
      sourceFileID: undefined,
      sheetName: undefined,
      columnNames: undefined,
      testResult: undefined,
      error: undefined,
    };
    const newNode: Node<FlowNodeData> = {
      id: nodeId,
      type: NodeType.INDEX_SOURCE,
      position,
      data: newNodeData,
    };
    get().addFlowNode(newNode);
    return newNode;
  },

  createSheetSelectorNode: (
    nodeId: string,
    position: { x: number; y: number },
    label?: string,
  ) => {
    const newNodeData: SheetSelectorNodeDataContext = {
      nodeType: NodeType.SHEET_SELECTOR,
      label: label || "Sheet定位",
      mode: "auto_by_index",
      targetFileID: undefined,
      manualSheetName: undefined,
      testResult: undefined,
      error: undefined,
    };
    const newNode: Node<FlowNodeData> = {
      id: nodeId,
      type: NodeType.SHEET_SELECTOR,
      position,
      data: newNodeData,
    };
    get().addFlowNode(newNode);
    return newNode;
  },

  createRowFilterNode: (
    nodeId: string,
    position: { x: number; y: number },
    label?: string,
  ) => {
    const newNodeData: RowFilterNodeDataContext = {
      nodeType: NodeType.ROW_FILTER,
      label: label || "行过滤",
      conditions: [],
      testResult: undefined,
      error: undefined,
    };
    const newNode: Node<FlowNodeData> = {
      id: nodeId,
      type: NodeType.ROW_FILTER,
      position,
      data: newNodeData,
    };
    get().addFlowNode(newNode);
    return newNode;
  },

  createRowLookupNode: (
    nodeId: string,
    position: { x: number; y: number },
    label?: string,
  ) => {
    const newNodeData: RowLookupNodeDataContext = {
      nodeType: NodeType.ROW_LOOKUP,
      label: label || "行查找",
      matchColumn: undefined,
      testResult: undefined,
      error: undefined,
    };
    const newNode: Node<FlowNodeData> = {
      id: nodeId,
      type: NodeType.ROW_LOOKUP,
      position,
      data: newNodeData,
    };
    get().addFlowNode(newNode);
    return newNode;
  },

  createAggregatorNode: (
    nodeId: string,
    position: { x: number; y: number },
    label?: string,
  ) => {
    const newNodeData: AggregatorNodeDataContext = {
      nodeType: NodeType.AGGREGATOR,
      label: label || "数据聚合",
      method: "sum",
      statColumn: undefined,
      testResult: undefined,
      error: undefined,
    };
    const newNode: Node<FlowNodeData> = {
      id: nodeId,
      type: NodeType.AGGREGATOR,
      position,
      data: newNodeData,
    };
    get().addFlowNode(newNode);
    return newNode;
  },

  createOutputNode: (
    nodeId: string,
    position: { x: number; y: number },
    label?: string,
  ) => {
    const newNodeData: OutputNodeDataContext = {
      nodeType: NodeType.OUTPUT,
      label: label || "输出结果",
      outputFormat: "table",
      testResult: undefined,
      error: undefined,
    };
    const newNode: Node<FlowNodeData> = {
      id: nodeId,
      type: NodeType.OUTPUT,
      position,
      data: newNodeData,
    };
    get().addFlowNode(newNode);
    return newNode;
  },

  updateNodeData: (nodeId, dataToUpdate: Partial<FlowNodeData>) => {
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

