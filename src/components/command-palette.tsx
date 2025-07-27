import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import {
  useCommandPalette,
  type CommandPaletteFile,
} from "@/lib/hooks/use-command-palette"
import {
  File,
  FileText,
  Image,
  Code,
  Archive,
  Music,
  Video,
} from "lucide-react"

// File type icon mapping
const getFileIcon = (fileName: string, type: string) => {
  if (type !== "file") return File

  const extension = fileName.split(".").pop()?.toLowerCase()

  switch (extension) {
    case "txt":
    case "md":
    case "mdx":
      return FileText
    case "js":
    case "ts":
    case "jsx":
    case "tsx":
    case "py":
    case "java":
    case "cpp":
    case "c":
    case "go":
    case "rs":
    case "php":
    case "rb":
      return Code
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return Image
    case "zip":
    case "tar":
    case "gz":
    case "rar":
      return Archive
    case "mp3":
    case "wav":
    case "flac":
      return Music
    case "mp4":
    case "avi":
    case "mov":
    case "mkv":
      return Video
    default:
      return File
  }
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { searchQuery, setSearchQuery, filteredFiles, selectFile } =
    useCommandPalette()

  // Group files by recent vs all
  const recentFiles = filteredFiles.filter((f) => f.isRecent)
  const otherFiles = filteredFiles.filter((f) => !f.isRecent)

  const handleSelect = (file: CommandPaletteFile) => {
    selectFile(file)
    onClose() // Ensure the dialog closes after selection
  }

  const renderFileItem = (file: CommandPaletteFile) => {
    const IconComponent = getFileIcon(file.title, file.type)
    const displayName = file.title
    const displayPath = file.path.split("/").slice(0, -1).join("/")

    return (
      <CommandItem
        key={file.id}
        value={`${file.id}-${displayName}-${file.path}`}
        onSelect={() => handleSelect(file)}
        className="flex items-center gap-2 px-4 py-2"
      >
        <IconComponent className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{displayName}</div>
          {displayPath && (
            <div className="text-xs text-muted-foreground truncate">
              {displayPath}
            </div>
          )}
        </div>
      </CommandItem>
    )
  }

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={onClose}
      title="Quick File Access"
      description="Search and navigate to files in your project"
      className="max-w-2xl"
    >
      <CommandInput
        placeholder="Search files..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList className="max-h-96">
        <CommandEmpty>No files found.</CommandEmpty>

        {recentFiles.length > 0 && (
          <CommandGroup heading="Recent Files">
            {recentFiles.map(renderFileItem)}
          </CommandGroup>
        )}

        {otherFiles.length > 0 && (
          <CommandGroup
            heading={recentFiles.length > 0 ? "All Files" : "Files"}
          >
            {otherFiles.map(renderFileItem)}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
