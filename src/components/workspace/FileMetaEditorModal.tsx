import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileMeta } from "@/types";
import { Button, Dialog } from "@radix-ui/themes";

interface FileMetaEditorModalProps {
  file: FileMeta;
}

const FileMetaEditorModal = ({ file }: FileMetaEditorModalProps) => {
  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button variant="soft" size="1">
          设置
        </Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Card>
          <CardHeader>
            <CardTitle>元数据编辑器</CardTitle>
            <CardContent></CardContent>
          </CardHeader>
        </Card>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default FileMetaEditorModal;
