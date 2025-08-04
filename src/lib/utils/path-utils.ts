import type { FileSystemNode } from "@/db/schema"
import { fileSystemNodeCollection } from "@/lib/collections"

export function getParentPath(path: string): string | null {
  if (path === "/" || path === "") return null

  const normalized = path.startsWith("/") ? path.slice(1) : path
  const segments = normalized.split("/").filter(Boolean)

  if (segments.length <= 1) return null

  return "/" + segments.slice(0, -1).join("/")
}

export function joinPaths(parent: string, child: string): string {
  return parent === "/" ? `/${child}` : `${parent}/${child}`
}

export function updateChildPaths(
  oldParentPath: string,
  newParentPath: string,
  allNodes: FileSystemNode[]
) {
  if (oldParentPath === newParentPath) return

  const oldPrefix = oldParentPath.endsWith("/")
    ? oldParentPath
    : oldParentPath + "/"
  const newPrefix = newParentPath.endsWith("/")
    ? newParentPath
    : newParentPath + "/"

  allNodes
    .filter((n) => n.path.startsWith(oldPrefix))
    .forEach((n) => {
      const updatedPath = n.path.replace(oldPrefix, newPrefix)
      fileSystemNodeCollection.update(n.id.toString(), (draft) => {
        draft.path = updatedPath
        draft.updatedAt = new Date()
      })
    })
}

export function updateNodePath(
  node: FileSystemNode,
  newPath: string,
  allNodes: FileSystemNode[]
) {
  const oldPath = node.path

  if (oldPath === newPath) return

  fileSystemNodeCollection.update(node.id.toString(), (draft) => {
    draft.path = newPath
    draft.updatedAt = new Date()
  })

  if (node.type === "directory") {
    updateChildPaths(oldPath, newPath, allNodes)
  }
}
