import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspaceContext } from "@/lib/workspace.functions";

export function useWorkspace() {
  const fetchContext = useServerFn(getWorkspaceContext);
  return useQuery({
    queryKey: ["workspace-context"],
    queryFn: () => fetchContext({}),
    staleTime: 30_000,
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
