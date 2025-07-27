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
      if (selectedFileNode?.fileSystemNode) {
        fileSystemNodeCollection.update(
          selectedFileNode.fileSystemNode.id.toString(),
          (draft) => {
            draft.title = title
            draft.updatedAt = new Date()
          }
        )
      }
    },
    [selectedFileNode]
  )

  // Only render editor if we have a selected file (not directory)
  if (!selectedFileNode || selectedFileNode.fileSystemNode.type !== "file") {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="rounded-container text-center text-muted-foreground max-w-md">
          <div className="text-lg font-medium mb-2">
            Welcome to your workspace
          </div>
          <div className="text-sm">
            Select a file from the sidebar to start editing, or create a new one
            to begin writing.
          </div>
        </div>
      </div>
    )
  }

  const fileContent = selectedFileNode.fileSystemNode.content ?? undefined
  const fileTitle = selectedFileNode.fileSystemNode.title ?? undefined

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
