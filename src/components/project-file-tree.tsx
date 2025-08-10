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
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { FolderPlusIcon, FilePlusIcon, TrashIcon, EditIcon } from "lucide-react"
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
  const [dialogState, setDialogState] = useState<{
    open: boolean
    type: "file" | "directory"
    parentPath: string
    name: string
    isCreating: boolean
  }>({
    open: false,
    type: "file",
    parentPath: "/",
    name: "",
    isCreating: false,
  })
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    node: FileSystemNode | null
  }>({ open: false, node: null })
  const [editForm, setEditForm] = useState({ name: "", content: "" })
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
    return tree
  }, [fileSystemNodes])

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

  const resetDialog = () => {
    setDialogState({
      open: false,
      type: "file",
      parentPath: "/",
      name: "",
      isCreating: false,
    })
  }

  const handleCreateItem = async () => {
    if (!dialogState.name.trim() || !project || dialogState.isCreating) return

    setDialogState((prev) => ({ ...prev, isCreating: true }))

    try {
      const fullPath =
        dialogState.parentPath === "/"
          ? `/${dialogState.name.trim()}`
          : `${dialogState.parentPath}/${dialogState.name.trim()}`

      // Insert with temporary ID - Electric will sync back real ID
      await fileSystemNodeCollection.insert({
        id: Math.floor(Math.random() * 100000), // Temporary ID required
        projectId,
        path: fullPath,
        title: dialogState.name.trim(),
        type: dialogState.type,
        content: null,
        metadata: {},
        isDeleted: false,
        userIds: [project.ownerId, ...project.sharedUserIds], // Critical for sync
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      toast.success(
        `${dialogState.type === "directory" ? "📁 Folder" : "📄 File"} '${dialogState.name.trim()}' created`
      )

      // Set the path to auto-expand and select the newly created item
      setLastCreatedPath(fullPath)

      resetDialog()
    } catch (error) {
      console.error("Creation error:", error)
      toast.error(`Failed to create ${dialogState.type}`)
      setDialogState((prev) => ({ ...prev, isCreating: false }))
    }
  }

  const handleEdit = (node: FileSystemNode) => {
    setEditDialog({ open: true, node })
    setEditForm({
      name: node.title,
      content: node.content || "",
    })
  }

  const handleSaveEdit = () => {
    if (!editDialog.node || !editForm.name.trim()) return

    const node = editDialog.node
    const oldName = node.title
    const newName = editForm.name.trim()
    const oldPath = node.path
    const newPath = node.path.replace(
      new RegExp(`/${node.title}$`),
      `/${newName}`
    )

    // Update the current node
    fileSystemNodeCollection.update(node.id.toString(), (draft) => {
      draft.title = newName
      draft.path = newPath
      draft.content = editForm.content.trim() || null
      draft.updatedAt = new Date()
    })

    // If this is a directory, update descendants automatically
    if (node.type === "directory") {
      updateChildPaths(oldPath, newPath, fileSystemNodes)
    }

    // Sync open tabs and active file path
    updateOpenFilePaths(oldPath, newPath, node.type === "directory")

    if (oldName !== newName) {
      toast.success(`✏️ '${oldName}' renamed to '${newName}'`)
    } else {
      toast.success(`💾 '${newName}' updated`)
    }

    setEditDialog({ open: false, node: null })
    setEditForm({ name: "", content: "" })
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
        onContextMenu: (e: React.MouseEvent) => {
          e.preventDefault()
          setContextMenu({
            open: true,
            x: e.clientX,
            y: e.clientY,
            node: node,
          })
        },
        children: node.children
          ? addContextMenu(node.children as FileTreeNode[])
          : undefined,
      }))
    }
    return addContextMenu(treeData)
  }, [treeData])

  if (!project) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Project not found</div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-2 pb-2">
          <h3 className="text-sm font-medium">Files</h3>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDialogState({
                  open: true,
                  type: "file",
                  parentPath: "/",
                  name: "",
                  isCreating: false,
                })
              }
              className="h-6 w-6 p-0"
              disabled={dialogState.isCreating}
            >
              <FilePlusIcon className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDialogState({
                  open: true,
                  type: "directory",
                  parentPath: "/",
                  name: "",
                  isCreating: false,
                })
              }
              className="h-6 w-6 p-0"
              disabled={dialogState.isCreating}
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

      {/* New Item Dialog */}
      <Dialog
        open={dialogState.open}
        onOpenChange={(open) => {
          if (!open) {
            resetDialog()
          } else {
            setDialogState((prev) => ({ ...prev, open }))
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create New {dialogState.type === "file" ? "File" : "Folder"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={dialogState.name}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={`${dialogState.type === "file" ? "file" : "folder"}.${dialogState.type === "file" ? "txt" : ""}`}
                onKeyDown={(e) => e.key === "Enter" && handleCreateItem()}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Location: {dialogState.parentPath}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateItem}
              disabled={dialogState.isCreating}
            >
              {dialogState.isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog({ ...editDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editDialog.node?.type === "file" ? "File" : "Folder"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              />
            </div>
            {editDialog.node?.type === "file" && (
              <div>
                <label className="text-sm font-medium">Content</label>
                <textarea
                  value={editForm.content}
                  onChange={(e) =>
                    setEditForm({ ...editForm, content: e.target.value })
                  }
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="File content..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, node: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    setDialogState({
                      open: true,
                      type: "file",
                      parentPath: contextMenu.node
                        ? contextMenu.node.path
                        : "/",
                      name: "",
                      isCreating: false,
                    })
                    setContextMenu({ open: false, x: 0, y: 0, node: null })
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                  disabled={dialogState.isCreating}
                >
                  <FilePlusIcon className="h-4 w-4" />
                  New File
                </button>
                <button
                  onClick={() => {
                    setDialogState({
                      open: true,
                      type: "directory",
                      parentPath: contextMenu.node
                        ? contextMenu.node.path
                        : "/",
                      name: "",
                      isCreating: false,
                    })
                    setContextMenu({ open: false, x: 0, y: 0, node: null })
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                  disabled={dialogState.isCreating}
                >
                  <FolderPlusIcon className="h-4 w-4" />
                  New Folder
                </button>
                {contextMenu.node && (
                  <>
                    <button
                      onClick={() => {
                        handleEdit(contextMenu.node!.fileSystemNode)
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
                    handleEdit(contextMenu.node!.fileSystemNode)
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
