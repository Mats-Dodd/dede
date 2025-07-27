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

  const handleTitleChange = useCallback(
    (title: string) => {
      console.log("🏷️ Title change triggered:", {
        title,
        selectedFileNode: selectedFileNode?.fileSystemNode?.id,
      })
      if (selectedFileNode?.fileSystemNode) {
        console.log("📝 Updating title in collection:", {
          id: selectedFileNode.fileSystemNode.id,
          oldTitle: selectedFileNode.fileSystemNode.title,
          newTitle: title,
        })
        fileSystemNodeCollection.update(
          selectedFileNode.fileSystemNode.id.toString(),
          (draft) => {
            draft.title = title
            draft.updatedAt = new Date()
            console.log("✅ Draft updated:", {
              title: draft.title,
              updatedAt: draft.updatedAt,
            })
          }
        )
      } else {
        console.warn("❌ No selected file node for title update")
      }
    },
    [selectedFileNode]
  )

  const fileContent = selectedFileNode?.fileSystemNode?.content ?? undefined
  const fileTitle = selectedFileNode?.fileSystemNode?.title ?? undefined

  return (
    <div className="h-full">
      <Tiptap
        title={fileTitle}
        content={fileContent}
        onTitleChange={handleTitleChange}
        onContentChange={handleContentChange}
      />
    </div>
  )
}
