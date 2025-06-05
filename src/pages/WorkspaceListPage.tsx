import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import useToast from "@/hooks/useToast";
import {
  useSaveWorkspaceMutation,
  useWorkspaceListQuery,
} from "@/hooks/workspaceQueries";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

type WorkspaceListItem = {
  id: string;
  name: string;
};

export function WorkspaceListPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleNavigate = (id: string) => {
    navigate(`/workspace/${id}`);
  };

  // 只获取需要的zustand方法
  const createWorkspace = useWorkspaceStore((state) => state.createWorkspace);
  const resetDirty = useWorkspaceStore((state) => state.resetDirty);

  // 使用React Query获取工作区列表
  const { workspaces, isLoading, error, refetch } = useWorkspaceListQuery();
  const {
    saveWorkspace,
    isSaving,
  } = useSaveWorkspaceMutation();

  const handleCreateNew = async () => {
    if (isSaving) return;
    
    const newId = uuidv4();
    const defaultNewName = `新工作区 ${new Date().toLocaleDateString()}`;

    // 在zustand中创建新工作区
    createWorkspace(newId, defaultNewName);

    // 获取当前工作区状态
    const newWorkspace = useWorkspaceStore.getState().currentWorkspace;

    if (newWorkspace) {
      try {
        await saveWorkspace({ id: newId, workspace: newWorkspace });
        resetDirty();
        queryClient.invalidateQueries(["workspaces"]);
        toast.success("工作区创建成功");
        navigate(`/workspace/${newId}`);
      } catch (error) {
        toast.error("创建工作区失败");
        console.error(error);
      }
    }
  };

  if (isLoading) return (
    <Flex align="center" justify="center" style={{ height: '100vh' }}>
      <Text size="4">加载工作区列表中...</Text>
    </Flex>
  );
  
  if (error) return (
    <Flex align="center" justify="center" style={{ height: '100vh' }}>
      <Text size="4" color="red">加载工作区列表失败: {error.message}</Text>
      <Button size="3" color="red" onClick={() => refetch()}>
        重试
      </Button>

    </Flex>
  );

  return (
    <Box className="container mx-auto p-8">
      <Flex direction="column" gap="6">
        <Flex justify="between" align="center">
          <Heading size="6">Excel ETL 数据流程工作区</Heading>
          <Button size="3" color="green" onClick={handleCreateNew} disabled={isSaving}>
            <PlusCircledIcon /> 创建新工作区
          </Button>
        </Flex>
        
        <Text size="2" color="gray">
          工作区用于管理Excel数据处理流程，您可以创建多个工作区来处理不同的数据分析任务。
        </Text>
        
        {workspaces && workspaces.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws: WorkspaceListItem) => (
              <Card key={ws.id} className="overflow-hidden border border-gray-200 hover:shadow-md transition-shadow">
                <CardHeader className="bg-gray-50">
                  <CardTitle>{ws.name}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <Text size="1" color="gray">ID: {ws.id.substring(0, 8)}...</Text>
                </CardContent>
                <CardFooter className="bg-gray-50">
                  <Button variant="soft" onClick={() => handleNavigate(ws.id)}>
                    打开工作区
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Flex 
            direction="column" 
            align="center" 
            justify="center" 
            gap="4"
            style={{ 
              height: '300px', 
              border: '2px dashed var(--gray-5)',
              borderRadius: '8px'
            }}
          >
            <Text size="5" color="gray">暂无工作区</Text>
            <Button size="3" color="green" onClick={handleCreateNew} disabled={isSaving}>
              <PlusCircledIcon /> 创建第一个工作区
            </Button>
          </Flex>
        )}
      </Flex>
    </Box>
  );
}
