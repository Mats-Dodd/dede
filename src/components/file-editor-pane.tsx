import { useFileNode } from "@/lib/hooks/use-file-node"
import Tiptap from "@/components/editor"
import { TabsContent } from "@/components/ui/tabs"

export default function FileEditorPane({
  fileId,
}: {
  fileId: string
  key?: string
}) {
  const { node, setTitle, setContent } = useFileNode(fileId)

  if (!node) return null

  return (
    <TabsContent value={fileId} className="flex-1 mt-0 border-0">
      <Tiptap
        title={node.title ?? "Untitled"}
        content={node.content ?? ""}
        onTitleChange={setTitle}
        onContentChange={setContent}
      />
    </TabsContent>
  )
}
