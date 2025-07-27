import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFileContext } from "@/lib/file-context"
import Tiptap from "@/components/editor"
import { useCallback } from "react"
import { fileSystemNodeCollection } from "@/lib/collections"
import { X } from "lucide-react"

export default function TabManager() {
  const { openFiles, activeFileId, setActiveFile, closeFile } = useFileContext()

  const handleContentChange = useCallback((content: string, fileId: string) => {
    fileSystemNodeCollection.update(fileId, (draft) => {
      draft.content = content
      draft.updatedAt = new Date()
    })
  }, [])

  const handleTitleChange = useCallback((title: string, fileId: string) => {
    fileSystemNodeCollection.update(fileId, (draft) => {
      draft.title = title
      draft.updatedAt = new Date()
    })
  }, [])

  const handleCloseTab = useCallback(
    (fileId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      closeFile(fileId)
    },
    [closeFile]
  )

  if (openFiles.length === 0) {
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

  return (
    <div className="h-full flex flex-col">
      <Tabs
        value={activeFileId}
        onValueChange={setActiveFile}
        className="flex-1 flex flex-col"
      >
        <TabsList className="before:bg-border relative h-auto w-full gap-0.5 bg-transparent p-0 before:absolute before:inset-x-0 before:bottom-0 before:h-px justify-start">
          {openFiles.map((file) => {
            const fileId = file.fileSystemNode.id.toString()
            const fileName = file.fileSystemNode.title || "Untitled"

            return (
              <div key={`tab-${fileId}`} className="relative group">
                <TabsTrigger
                  value={fileId}
                  className="bg-muted overflow-hidden rounded-b-none border-x border-t py-2 data-[state=active]:z-10 data-[state=active]:shadow-none pr-8"
                >
                  <span className="truncate max-w-32">{fileName}</span>
                </TabsTrigger>
                <div
                  onClick={(e) => handleCloseTab(fileId, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 rounded p-0.5 transition-opacity cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </div>
              </div>
            )
          })}
        </TabsList>

        {openFiles.map((file) => {
          const fileId = file.fileSystemNode.id.toString()
          const fileContent = file.fileSystemNode.content ?? undefined
          const fileTitle = file.fileSystemNode.title ?? undefined

          return (
            <TabsContent
              key={`content-${fileId}`}
              value={fileId}
              className="flex-1 mt-0"
            >
              <Tiptap
                title={fileTitle}
                content={fileContent}
                onTitleChange={(title) => handleTitleChange(title, fileId)}
                onContentChange={(content) =>
                  handleContentChange(content, fileId)
                }
              />
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
