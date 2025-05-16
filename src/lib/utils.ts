import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FileMeta } from "@/types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to get a file by ID from the current workspace
export const getFileById = (fileId: string): FileMeta | undefined => {
  const state = useWorkspaceStore.getState();
  return state.currentWorkspace?.files.find((f) => f.id === fileId);
};
