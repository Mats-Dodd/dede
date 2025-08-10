"use client"

import React, { useState, useMemo } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { TreeView, type TreeDataItem } from "@/components/file-tree"
import { fileSystemNodeCollection, projectCollection } from "@/lib/collections"
import {
  transformFileSystemNodesToTree,
  type FileTreeNode,
} from "@/lib/utils/file-tree-utils"
import { useFileContext } from "@/lib/file-context"
import { type FileSystemNode } from "@/db/schema"
import { Button } from "@/components/ui/button"
import {
  FolderPlusIcon,
  FilePlusIcon,
  TrashIcon,
  EditIcon,
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
} from "lucide-react"
import {
  joinPaths,
  updateNodePath,
  updateChildPaths,
} from "@/lib/utils/path-utils"
import { toast } from "sonner"

interface ProjectFileTreeProps {
  projectId: number
}

export function ProjectFileTree({ projectId }: ProjectFileTreeProps) {
  const { selectedFileNode, setSelectedFileNode, updateOpenFilePaths } =
    useFileContext()
  const [lastCreatedPath, setLastCreatedPath] = useState<string | undefined>()
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [ghostNodes, setGhostNodes] = useState<FileTreeNode[]>([])
  const [contextMenu, setContextMenu] = useState<{
    open: boolean
    x: number
    y: number
    node: FileTreeNode | null
  }>({ open: false, x: 0, y: 0, node: null })

  const { data: rawFileSystemNodes = [] } = useLiveQuery(
    (q) =>
      q
        .from({ fileSystemNodeCollection })
        .where(({ fileSystemNodeCollection }) =>
          eq(fileSystemNodeCollection.projectId, projectId)
        ),
    [projectId]
  )

  // Filter out phantom records with invalid data
  const fileSystemNodes = React.useMemo(() => {
    return rawFileSystemNodes.filter((node) => {
      // Filter out phantom records that have invalid name/path combinations
      const isPhantomRecord =
        (node.title === "name" && node.path === "file") ||
        // Also filter out any records with empty/invalid names or paths
        !node.title ||
        !node.path ||
        node.title.trim() === "" ||
        node.path.trim() === ""

      return !isPhantomRecord
    })
  }, [rawFileSystemNodes])
  const { data: projects = [] } = useLiveQuery(
    (q) =>
      q
        .from({ projectCollection })
        .where(({ projectCollection }) => eq(projectCollection.id, projectId)),
    [projectId]
  )
  const project = projects[0]

  const treeData = useMemo(() => {
    const tree = transformFileSystemNodesToTree(fileSystemNodes)
    // Merge ghost nodes into the tree
    const mergedTree = [...tree]

    ghostNodes.forEach((ghostNode) => {
      // Find parent directory or add to root
      const parentPath = ghostNode.path.substring(
        0,
        ghostNode.path.lastIndexOf("/")
      )

      if (!parentPath || parentPath === "") {
        // Add to root
        mergedTree.push(ghostNode)
      } else {
        // Find parent and add as child
        const findAndAddToParent = (nodes: FileTreeNode[]): boolean => {
          for (const node of nodes) {
            if (node.path === parentPath && node.type === "directory") {
              if (!node.children) node.children = []
              node.children.push(ghostNode)
              return true
            }
            if (node.children) {
              if (findAndAddToParent(node.children as FileTreeNode[])) {
                return true
              }
            }
          }
          return false
        }

        if (!findAndAddToParent(mergedTree)) {
          // If parent not found, add to root anyway
          mergedTree.push(ghostNode)
        }
      }
    })

    return mergedTree
  }, [fileSystemNodes, ghostNodes])

  const handleNodeSelect = (item: TreeDataItem | undefined) => {
    if (item && "fileSystemNode" in item) {
      const fileNode = item as FileTreeNode
      // Only set selectedFileNode for actual files, not directories
      if (fileNode.type === "file") {
        setSelectedFileNode(fileNode)
      }

      // Clear the lastCreatedPath after successful selection
      if (lastCreatedPath && fileNode.path === lastCreatedPath) {
        setLastCreatedPath(undefined)
      }
    } else {
      setSelectedFileNode(undefined)
    }
  }

  const handleDocumentDrag = (
    sourceItem: TreeDataItem,
    targetItem: TreeDataItem
  ) => {
    if (!("fileSystemNode" in sourceItem) || !("fileSystemNode" in targetItem))
      return

    const source = sourceItem as FileTreeNode
    const target = targetItem as FileTreeNode

    if (target.type !== "directory") return

    const oldPath = source.fileSystemNode.path
    const newPath = joinPaths(target.path, source.fileSystemNode.title)

    updateNodePath(source.fileSystemNode, newPath, fileSystemNodes)
    updateOpenFilePaths(oldPath, newPath, source.type === "directory")
  }

  const handleRootDrop = (sourceItem: TreeDataItem) => {
    if (!("fileSystemNode" in sourceItem)) return

    const source = sourceItem as FileTreeNode
    const fileName = source.fileSystemNode.title
    const currentPath = source.fileSystemNode.path
    const targetPath = `/${fileName}`

    // Skip if already at root
    if (currentPath === targetPath) {
      toast.info(`'${fileName}' is already at root level`)
      return
    }

    // Check for name conflicts at root
    const existingAtRoot = fileSystemNodes.find(
      (node) => node.path === targetPath && !node.isDeleted
    )
    if (existingAtRoot) {
      toast.error(`Item '${fileName}' already exists at root`)
      return
    }

    updateNodePath(source.fileSystemNode, targetPath, fileSystemNodes)
    updateOpenFilePaths(currentPath, targetPath, source.type === "directory")
    toast.success(`📁 Moved '${fileName}' to root`)
  }

  const handleCreateNewItem = async (
    type: "file" | "directory",
    parentPath: string,
    name: string
  ) => {
    if (!name.trim() || !project) return

    try {
      const fullPath =
        parentPath === "/" ? `/${name.trim()}` : `${parentPath}/${name.trim()}`

      // Check if item already exists
      const existing = fileSystemNodes.find(
        (node) => node.path === fullPath && !node.isDeleted
      )
      if (existing) {
        toast.error(
          `${type === "directory" ? "Folder" : "File"} '${name.trim()}' already exists`
        )
        return
      }

      // Insert with temporary ID - Electric will sync back real ID
      await fileSystemNodeCollection.insert({
        id: Math.floor(Math.random() * 100000), // Temporary ID required
        projectId,
        path: fullPath,
        title: name.trim(),
        type,
        content: null,
        contentCRDT: null,
        metadata: {},
        isDeleted: false,
        userIds: [project.ownerId, ...project.sharedUserIds], // Critical for sync
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      toast.success(
        `${type === "directory" ? "📁 Folder" : "📄 File"} '${name.trim()}' created`
      )

      // Set the path to auto-expand and select the newly created item
      setLastCreatedPath(fullPath)
    } catch (error) {
      console.error("Creation error:", error)
      toast.error(`Failed to create ${type}`)
    }
  }

  const handleStartEdit = (nodeId: string) => {
    setEditingNodeId(nodeId)
  }

  const handleCompleteEdit = (node: FileSystemNode, newName: string) => {
    if (!newName.trim() || newName === node.title) {
      setEditingNodeId(null)
      return
    }

    const oldName = node.title
    const oldPath = node.path
    const newPath = node.path.replace(
      new RegExp(`/${node.title}$`),
      `/${newName.trim()}`
    )

    // Update the current node
    fileSystemNodeCollection.update(node.id.toString(), (draft) => {
      draft.title = newName.trim()
      draft.path = newPath
      draft.updatedAt = new Date()
    })

    // If this is a directory, update descendants automatically
    if (node.type === "directory") {
      updateChildPaths(oldPath, newPath, fileSystemNodes)
    }

    // Sync open tabs and active file path
    updateOpenFilePaths(oldPath, newPath, node.type === "directory")

    toast.success(`✏️ '${oldName}' renamed to '${newName.trim()}'`)
    setEditingNodeId(null)
  }

  const handleCancelEdit = () => {
    setEditingNodeId(null)
  }

  const createGhostNode = (type: "file" | "directory", parentPath: string) => {
    const tempId = `ghost-${Date.now()}`
    const ghostPath =
      parentPath === "/" ? "/untitled" : `${parentPath}/untitled`

    const ghostNode: FileTreeNode = {
      id: tempId,
      name: "",
      path: ghostPath,
      type,
      fileSystemNode: {
        id: -1,
        projectId,
        path: ghostPath,
        title: "",
        type,
        content: null,
        contentCRDT: null,
        metadata: {},
        isDeleted: false,
        userIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      icon: type === "directory" ? FolderIcon : FileIcon,
      openIcon: type === "directory" ? FolderOpenIcon : undefined,
      selectedIcon: type === "directory" ? FolderOpenIcon : FileIcon,
      children: type === "directory" ? [] : undefined,
      draggable: false,
      droppable: false,
      isGhost: true,
      isEditing: true,
    }

    setGhostNodes((prev) => [...prev, ghostNode])
    setEditingNodeId(tempId)
  }

  const handleGhostComplete = async (ghostId: string, newName: string) => {
    const ghost = ghostNodes.find((g) => g.id === ghostId)
    if (!ghost || !newName.trim()) {
      // Cancel if no name provided
      setGhostNodes((prev) => prev.filter((g) => g.id !== ghostId))
      setEditingNodeId(null)
      return
    }

    const parentPath = ghost.path.substring(0, ghost.path.lastIndexOf("/"))
    const fullPath =
      parentPath === ""
        ? `/${newName.trim()}`
        : `${parentPath}/${newName.trim()}`

    // Check if item already exists
    const existing = fileSystemNodes.find(
      (node) => node.path === fullPath && !node.isDeleted
    )
    if (existing) {
      toast.error(
        `${ghost.type === "directory" ? "Folder" : "File"} '${newName.trim()}' already exists`
      )
      setGhostNodes((prev) => prev.filter((g) => g.id !== ghostId))
      setEditingNodeId(null)
      return
    }

    await handleCreateNewItem(
      ghost.type,
      parentPath === "" ? "/" : parentPath,
      newName.trim()
    )

    // Remove ghost node after creation
    setGhostNodes((prev) => prev.filter((g) => g.id !== ghostId))
    setEditingNodeId(null)
  }

  const handleGhostCancel = (ghostId: string) => {
    setGhostNodes((prev) => prev.filter((g) => g.id !== ghostId))
    setEditingNodeId(null)
  }

  const handleDelete = (node: FileSystemNode) => {
    const itemType = node.type === "directory" ? "Folder" : "File"

    // If this is a directory, delete all child nodes first
    if (node.type === "directory") {
      const childNodes = fileSystemNodes.filter((child) =>
        child.path.startsWith(node.path + "/")
      )

      childNodes.forEach((child) => {
        fileSystemNodeCollection.delete(child.id.toString())
      })
    }

    // Delete the node itself
    fileSystemNodeCollection.delete(node.id.toString())

    toast.success(`🗑️ ${itemType} '${node.title}' deleted`)
  }

  const treeDataWithContextMenu: TreeDataItem[] = useMemo(() => {
    const addContextMenu = (nodes: FileTreeNode[]): TreeDataItem[] => {
      return nodes.map((node) => ({
        ...node,
        isEditing: editingNodeId === node.id,
        onStartEdit: () => handleStartEdit(node.id),
        onCompleteEdit: (newName: string) => {
          if (node.isGhost) {
            handleGhostComplete(node.id, newName)
          } else {
            handleCompleteEdit(node.fileSystemNode, newName)
          }
        },
        onCancelEdit: () => {
          if (node.isGhost) {
            handleGhostCancel(node.id)
          } else {
            handleCancelEdit()
          }
        },
        onContextMenu: (e: React.MouseEvent) => {
          if (!node.isGhost) {
            e.preventDefault()
            setContextMenu({
              open: true,
              x: e.clientX,
              y: e.clientY,
              node: node,
            })
          }
        },
        children: node.children
          ? addContextMenu(node.children as FileTreeNode[])
          : undefined,
      }))
    }
    return addContextMenu(treeData)
  }, [treeData, editingNodeId, ghostNodes])

  if (!project) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Project not found</div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-2 pb-2">
          <h3 className="text-sm font-medium"></h3>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => createGhostNode("file", "/")}
              className="h-6 w-6 p-0"
            >
              <FilePlusIcon className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => createGhostNode("directory", "/")}
              className="h-6 w-6 p-0"
            >
              <FolderPlusIcon className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {treeDataWithContextMenu.length > 0 ? (
          <>
            <TreeView
              data={treeDataWithContextMenu}
              initialSelectedItemId={selectedFileNode?.id}
              initialSelectedPath={lastCreatedPath}
              onSelectChange={handleNodeSelect}
              onDocumentDrag={handleDocumentDrag}
              onRootDrop={handleRootDrop}
              onRenameShortcut={(item) => {
                if ("fileSystemNode" in item) {
                  const fileNode = item as FileTreeNode
                  handleStartEdit(fileNode.id)
                }
              }}
              className="min-h-[200px]"
            />
            {lastCreatedPath && (
              <div className="text-xs text-muted-foreground p-2">
                Debug: lastCreatedPath = {lastCreatedPath}
              </div>
            )}
            {/* Clickable area that fills remaining space */}
            <div
              className="flex-1 min-h-[100px]"
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({
                  open: true,
                  x: e.clientX,
                  y: e.clientY,
                  node: null,
                })
              }}
            />
          </>
        ) : (
          <div
            className="flex-1 p-4 text-center text-sm text-muted-foreground"
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({
                open: true,
                x: e.clientX,
                y: e.clientY,
                node: null,
              })
            }}
          >
            No files yet. Create your first file or folder.
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.open && (
        <div
          className="fixed z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div
            className="fixed inset-0"
            onClick={() =>
              setContextMenu({ open: false, x: 0, y: 0, node: null })
            }
          />
          <div className="bg-white border border-gray-200 rounded-md shadow-lg p-1 min-w-[160px] relative z-10">
            {!contextMenu.node || contextMenu.node.type === "directory" ? (
              <div className="space-y-1">
                <button
                  onClick={() => {
                    const parentPath = contextMenu.node
                      ? contextMenu.node.path
                      : "/"
                    createGhostNode("file", parentPath)
                    setContextMenu({ open: false, x: 0, y: 0, node: null })
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                >
                  <FilePlusIcon className="h-4 w-4" />
                  New File
                </button>
                <button
                  onClick={() => {
                    const parentPath = contextMenu.node
                      ? contextMenu.node.path
                      : "/"
                    createGhostNode("directory", parentPath)
                    setContextMenu({ open: false, x: 0, y: 0, node: null })
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                >
                  <FolderPlusIcon className="h-4 w-4" />
                  New Folder
                </button>
                {contextMenu.node && (
                  <>
                    <button
                      onClick={() => {
                        handleStartEdit(contextMenu.node!.id)
                        setContextMenu({ open: false, x: 0, y: 0, node: null })
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                    >
                      <EditIcon className="h-4 w-4" />
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        handleDelete(contextMenu.node!.fileSystemNode)
                        setContextMenu({ open: false, x: 0, y: 0, node: null })
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <button
                  onClick={() => {
                    handleStartEdit(contextMenu.node!.id)
                    setContextMenu({ open: false, x: 0, y: 0, node: null })
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                >
                  <EditIcon className="h-4 w-4" />
                  Rename
                </button>
                <button
                  onClick={() => {
                    handleDelete(contextMenu.node!.fileSystemNode)
                    setContextMenu({ open: false, x: 0, y: 0, node: null })
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
