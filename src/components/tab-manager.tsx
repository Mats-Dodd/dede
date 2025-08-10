import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFileContext } from "@/lib/file-context"
import FileEditorPane from "@/components/file-editor-pane"
import { useCallback, useState } from "react"
import { X } from "lucide-react"
import {
  useMacKeyboardShortcuts,
  createMacShortcut,
} from "@/lib/hooks/use-mac-keyboard-shortcuts"
import { useTabNavigation } from "@/lib/hooks/use-tab-navigation"

export default function TabManager() {
  const {
    openFiles,
    activeFilePath,
    setActiveFile,
    closeFile,
    reorderOpenFiles,
  } = useFileContext()

  // Tab navigation actions
  const { goToNextTab, goToPreviousTab, goToTabByIndex, goToLastTab } =
    useTabNavigation()

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Mac-optimized keyboard shortcuts for tab navigation
  useMacKeyboardShortcuts([
    // Primary tab navigation with Cmd+Shift+Arrow keys
    {
      ...createMacShortcut("ArrowRight", { shiftKey: true }),
      handler: goToNextTab,
    },
    {
      ...createMacShortcut("ArrowLeft", { shiftKey: true }),
      handler: goToPreviousTab,
    },
    // Jump to tab by number (Cmd+1 through Cmd+9)
    ...Array.from({ length: 9 }, (_, i) => ({
      ...createMacShortcut((i + 1).toString()),
      handler: () => goToTabByIndex(i + 1),
    })),
    // Jump to last tab (Cmd+0)
    {
      ...createMacShortcut("0"),
      handler: goToLastTab,
    },
  ])

  // Deduplicate openFiles to prevent duplicate key errors
  const deduplicatedOpenFiles = openFiles.filter(
    (file, index, arr) =>
      arr.findIndex(
        (f) =>
          f.fileSystemNode.id.toString() === file.fileSystemNode.id.toString()
      ) === index
  )

  const handleCloseTab = useCallback(
    (filePath: string, e: React.MouseEvent) => {
      e.stopPropagation()
      closeFile(filePath)
    },
    [closeFile]
  )

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverIndex(index)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDragLeave = useCallback(
    (e: React.DragEvent, index: number) => {
      if (dragOverIndex === index) {
        setDragOverIndex(null)
      }
    },
    [dragOverIndex]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault()

      if (draggedIndex !== null && draggedIndex !== dropIndex) {
        reorderOpenFiles(draggedIndex, dropIndex)
      }

      setDraggedIndex(null)
      setDragOverIndex(null)
    },
    [draggedIndex, reorderOpenFiles]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }, [])

  if (deduplicatedOpenFiles.length === 0) {
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
        value={activeFilePath}
        onValueChange={setActiveFile}
        className="flex-1 flex flex-col"
      >
        <TabsList className="shrink-0">
          {deduplicatedOpenFiles.map((file, index) => {
            const filePath = file.fileSystemNode.path
            const fileName = file.fileSystemNode.title || "Untitled"
            const isDragging = draggedIndex === index
            const isDragOver = dragOverIndex === index

            return (
              <div
                key={`tab-${filePath}`}
                className={`relative group transition-all duration-150 ${
                  isDragging
                    ? "opacity-50 cursor-grabbing scale-105"
                    : "cursor-grab"
                } ${isDragOver ? "border-l-4 border-blue-500 pl-1" : ""}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnter={handleDragEnter}
                onDragLeave={(e) => handleDragLeave(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                <TabsTrigger value={filePath} className="pr-8 max-w-48">
                  <span className="truncate">{fileName}</span>
                </TabsTrigger>
                <button
                  onClick={(e) => handleCloseTab(filePath, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-data-[state=active]:opacity-100 hover:bg-muted rounded-sm p-0.5 transition-all duration-200 cursor-pointer z-10"
                  type="button"
                  aria-label={`Close ${fileName}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </TabsList>

        {deduplicatedOpenFiles.map((file) => {
          const filePath = file.fileSystemNode.path

          return (
            <FileEditorPane key={`content-${filePath}`} filePath={filePath} />
          )
        })}
      </Tabs>
    </div>
  )
}
