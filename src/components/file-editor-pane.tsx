import { useFileNodeByPath } from "@/lib/hooks/use-file-node"
import Tiptap from "@/components/editor"
import { TabsContent } from "@/components/ui/tabs"

export default function FileEditorPane({
  filePath,
}: {
  filePath: string
  key?: string
}) {
  const { node, setTitle, setContent } = useFileNodeByPath(filePath)

  if (!node) return null

  return (
    <TabsContent value={filePath} className="flex-1 mt-0 border-0">
      <Tiptap
        title={node.title ?? "Untitled"}
        content={node.content ?? ""}
        onTitleChange={setTitle}
        onContentChange={setContent}
      />
    </TabsContent>
  )
}
