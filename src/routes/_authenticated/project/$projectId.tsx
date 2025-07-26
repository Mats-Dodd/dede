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

  console.log("📄 Project page - selectedFileNode:", selectedFileNode)
  console.log(
    "📄 Project page - fileContent:",
    selectedFileNode?.fileSystemNode?.content
  )

  const handleContentChange = useCallback(
    (content: string) => {
      console.log(
        "📝 Project page - Content changed:",
        content.substring(0, 50) + "..."
      )
      if (selectedFileNode?.fileSystemNode) {
        console.log(
          "📝 Project page - Updating file:",
          selectedFileNode.fileSystemNode.id
        )
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

  console.log(
    "📄 Project page - Final fileContent being passed to editor:",
    fileContent
  )

  return (
    <div className="h-full">
      <Tiptap content={fileContent} onContentChange={handleContentChange} />
    </div>
  )
}
