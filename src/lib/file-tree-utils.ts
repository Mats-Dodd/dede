import { type FileSystemNode } from "@/db/schema"
import { type TreeDataItem } from "@/components/file-tree"
import { FileIcon, FolderIcon, FolderOpenIcon } from "lucide-react"

export interface FileTreeNode extends TreeDataItem {
  path: string
  type: "file" | "directory"
  fileSystemNode: FileSystemNode
}

export function transformFileSystemNodesToTree(
  nodes: FileSystemNode[]
): FileTreeNode[] {
  const nodeMap = new Map<string, FileTreeNode>()
  const rootNodes: FileTreeNode[] = []

  nodes
    .filter((node) => !node.isDeleted)
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
    .forEach((node) => {
      const treeNode: FileTreeNode = {
        id: node.id.toString(),
        name: node.name,
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

      nodeMap.set(node.path, treeNode)
    })

  nodeMap.forEach((treeNode, path) => {
    const parentPath = getParentPath(path)

    if (parentPath && nodeMap.has(parentPath)) {
      const parent = nodeMap.get(parentPath)!
      if (parent.children) {
        parent.children.push(treeNode)
      }
    } else {
      rootNodes.push(treeNode)
    }
  })

  return rootNodes
}

function getParentPath(path: string): string | null {
  if (path === "/" || path === "") return null

  const normalizedPath = path.startsWith("/") ? path.slice(1) : path
  const segments = normalizedPath.split("/").filter(Boolean)

  if (segments.length <= 1) return null

  const parentSegments = segments.slice(0, -1)
  return "/" + parentSegments.join("/")
}

export function getFileIcon(filename: string): typeof FileIcon {
  const extension = filename.split(".").pop()?.toLowerCase()

  switch (extension) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return FileIcon
    case "json":
      return FileIcon
    case "md":
    case "mdx":
      return FileIcon
    case "css":
    case "scss":
    case "sass":
      return FileIcon
    case "html":
      return FileIcon
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
      return FileIcon
    default:
      return FileIcon
  }
}

export function createNewFileSystemNode(
  projectId: number,
  parentPath: string,
  name: string,
  type: "file" | "directory",
  content?: string
): Omit<FileSystemNode, "id" | "createdAt" | "updatedAt"> {
  const path = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`

  return {
    projectId,
    path,
    name,
    type,
    title: null, // Default to null for new files, can be set later in the editor
    content: content || null,
    metadata: {},
    isDeleted: false,
    userIds: [],
  }
}
