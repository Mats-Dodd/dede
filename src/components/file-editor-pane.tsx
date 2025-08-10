import { useFileNodeByPath } from "@/lib/hooks/use-file-node"
import { TabsContent } from "@/components/ui/tabs"
import Tiptap from "@/components/editor"
import type { Base64String } from "@/types/crdt"
import { useSharedLoroDoc } from "@/lib/loro-doc-registry"
import { useCrdtSnapshotSync } from "@/lib/crdt/useCrdtSnapshotSync"
export default function FileEditorPane({
  filePath,
}: {
  filePath: string
  key?: string
}) {
  const { node, setTitle, setContentCRDT } = useFileNodeByPath(filePath)
  const loroDoc = useSharedLoroDoc(filePath)
  const { markDirty } = useCrdtSnapshotSync({
    loroDoc,
    fileKey: filePath,
    remoteBase64: node?.contentCRDT as Base64String | null | undefined,
    onExport: setContentCRDT,
  })

  if (!node) return null

  return (
    <TabsContent value={filePath} className="flex-1 mt-0 border-0">
      <Tiptap
        title={node.title ?? "Untitled"}
        loroDoc={loroDoc}
        onTitleChange={setTitle}
        onDirty={markDirty}
      />
    </TabsContent>
  )
}
