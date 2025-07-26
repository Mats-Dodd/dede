import { createFileRoute } from "@tanstack/react-router"
import Tiptap from "@/components/editor"
import { useFileContext } from "@/lib/file-context"
import { fileSystemNodeCollection } from "@/lib/collections"
import { useCallback } from "react"

export const Route = createFileRoute("/_authenticated/project/$projectId")({
  component: ProjectPage,
  ssr: false,
})

function ProjectPage() {
  const { selectedFileNode } = useFileContext()

  const handleContentChange = useCallback(
    (content: string) => {
      if (selectedFileNode?.fileSystemNode) {
        fileSystemNodeCollection.update(
          selectedFileNode.fileSystemNode.id.toString(),
          (draft) => {
            draft.content = content
            draft.updatedAt = new Date()
          }
        )
      }
    },
    [selectedFileNode]
  )

  const fileContent = selectedFileNode?.fileSystemNode?.content ?? undefined

  return (
    <div className="h-full">
      <Tiptap content={fileContent} onContentChange={handleContentChange} />
    </div>
  )
}
