import { useLiveQuery, eq } from "@tanstack/react-db"
import { fileSystemNodeCollection } from "@/lib/collections"
import { type FileTreeNode } from "@/lib/utils/file-tree-utils"
import { type FileSystemNode } from "@/db/schema"
import { FileIcon, FolderIcon, FolderOpenIcon } from "lucide-react"

export function transformFileSystemNodeToFileTreeNode(
  node: FileSystemNode
): FileTreeNode {
  return {
    id: node.id.toString(),
    name: node.title,
    path: node.path,
    type: node.type as "file" | "directory",
    fileSystemNode: node,
    icon: node.type === "directory" ? FolderIcon : FileIcon,
    openIcon: node.type === "directory" ? FolderOpenIcon : undefined,
    selectedIcon: node.type === "directory" ? FolderOpenIcon : FileIcon,
    children: node.type === "directory" ? [] : undefined,
    draggable: true,
    droppable: node.type === "directory",
  }
}

export function useValidateAndRestoreFiles(
  _fileIds: number[],
  projectId: number
) {
  const { data: allFiles } = useLiveQuery((q) =>
    q
      .from({ file: fileSystemNodeCollection })
      .where(({ file }) => eq(file.projectId, projectId))
      .where(({ file }) => eq(file.isDeleted, false))
  )

  const validateAndRestoreFiles = (
    orderedFileIds: number[]
  ): FileTreeNode[] => {
    if (!allFiles || !orderedFileIds || orderedFileIds.length === 0) {
      return []
    }

    // Filter available files to only include requested IDs, then maintain order
    const availableFilesMap = new Map(allFiles.map((f) => [f.id, f]))

    const restoredFiles = orderedFileIds
      .map((id) => {
        const file = availableFilesMap.get(id)
        return file
      })
      .filter((file): file is FileSystemNode => !!file && file.type === "file")
      .map(transformFileSystemNodeToFileTreeNode)

    return restoredFiles
  }

  return { validateAndRestoreFiles, availableFiles: allFiles }
}
