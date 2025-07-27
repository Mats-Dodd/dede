"use client"

import React, { useState, useMemo } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { TreeView, type TreeDataItem } from "@/components/file-tree"
import { fileSystemNodeCollection, projectCollection } from "@/lib/collections"
import {
  transformFileSystemNodesToTree,
  type FileTreeNode,
} from "@/lib/file-tree-utils"
import { useCreateFileWithNavigation } from "@/lib/use-create-file-with-navigation"
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
import { toast } from "sonner"

interface ProjectFileTreeProps {
  projectId: number
}

export function ProjectFileTree({ projectId }: ProjectFileTreeProps) {
  const { selectedFileNode, setSelectedFileNode } = useFileContext()
  const { createFile, isCreating } = useCreateFileWithNavigation()
  const [newItemDialog, setNewItemDialog] = useState<{
    open: boolean
    type: "file" | "directory"
    parentPath: string
  }>({ open: false, type: "file", parentPath: "/" })
  const [newItemName, setNewItemName] = useState("")
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
        (node.name === "name" && node.path === "file") ||
        // Also filter out any records with empty/invalid names or paths
        !node.name ||
        !node.path ||
        node.name.trim() === "" ||
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
    return transformFileSystemNodesToTree(fileSystemNodes)
  }, [fileSystemNodes])

  const handleNodeSelect = (item: TreeDataItem | undefined) => {
    if (item && "fileSystemNode" in item) {
      const fileNode = item as FileTreeNode
      // Only set selectedFileNode for actual files, not directories
      if (fileNode.type === "file") {
        console.log(
          "🌳 project-file-tree calling setSelectedFileNode for:",
          fileNode.fileSystemNode.id.toString(),
          "title:",
          fileNode.fileSystemNode.title
        )
        setSelectedFileNode(fileNode)
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

    const newPath =
      target.path === "/" ? `/${source.name}` : `${target.path}/${source.name}`

    fileSystemNodeCollection.update(source.id, (draft) => {
      draft.path = newPath
      draft.updatedAt = new Date()
    })
  }

  const handleCreateItem = async () => {
    if (!newItemName.trim() || !project || isCreating) return

    try {
      await createFile({
        projectId,
        parentPath: newItemDialog.parentPath,
        name: newItemName.trim(),
        type: newItemDialog.type,
      })

      // Close dialog and reset form
      setNewItemName("")
      setNewItemDialog({ open: false, type: "file", parentPath: "/" })
    } catch (error) {
      console.error("Error creating file:", error)
      toast.error(`Failed to create ${newItemDialog.type}`)
    }
  }

  const handleEdit = (node: FileSystemNode) => {
    setEditDialog({ open: true, node })
    setEditForm({
      name: node.name,
      content: node.content || "",
    })
  }

  const handleSaveEdit = () => {
    if (!editDialog.node || !editForm.name.trim()) return

    const node = editDialog.node
    const oldName = node.name
    const newName = editForm.name.trim()
    const oldPath = node.path
    const newPath = node.path.replace(
      new RegExp(`/${node.name}$`),
      `/${newName}`
    )

    // Update the current node
    fileSystemNodeCollection.update(node.id.toString(), (draft) => {
      draft.name = newName
      draft.path = newPath
      draft.content = editForm.content.trim() || null
      draft.updatedAt = new Date()
    })

    // If this is a directory, update all child nodes' paths
    if (node.type === "directory") {
      const childNodes = fileSystemNodes.filter((child) =>
        child.path.startsWith(oldPath + "/")
      )

      childNodes.forEach((child) => {
        const updatedChildPath = child.path.replace(oldPath, newPath)
        fileSystemNodeCollection.update(child.id.toString(), (draft) => {
          draft.path = updatedChildPath
          draft.updatedAt = new Date()
        })
      })
    }

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

    toast.success(`🗑️ ${itemType} '${node.name}' deleted`)
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
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-medium">Files</h3>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setNewItemDialog({ open: true, type: "file", parentPath: "/" })
              }
              className="h-6 w-6 p-0"
              disabled={isCreating}
            >
              <FilePlusIcon className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setNewItemDialog({
                  open: true,
                  type: "directory",
                  parentPath: "/",
                })
              }
              className="h-6 w-6 p-0"
              disabled={isCreating}
            >
              <FolderPlusIcon className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {treeDataWithContextMenu.length > 0 ? (
          <TreeView
            data={treeDataWithContextMenu}
            initialSelectedItemId={selectedFileNode?.id}
            onSelectChange={handleNodeSelect}
            onDocumentDrag={handleDocumentDrag}
            className="min-h-[200px]"
          />
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No files yet. Create your first file or folder.
          </div>
        )}
      </div>

      {/* New Item Dialog */}
      <Dialog
        open={newItemDialog.open}
        onOpenChange={(open) => setNewItemDialog({ ...newItemDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create New {newItemDialog.type === "file" ? "File" : "Folder"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={`${newItemDialog.type === "file" ? "file" : "folder"}.${newItemDialog.type === "file" ? "txt" : ""}`}
                onKeyDown={(e) => e.key === "Enter" && handleCreateItem()}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Location: {newItemDialog.parentPath}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setNewItemDialog({ open: false, type: "file", parentPath: "/" })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleCreateItem} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
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
      {contextMenu.open && contextMenu.node && (
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
            {contextMenu.node.type === "directory" ? (
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setNewItemDialog({
                      open: true,
                      type: "file",
                      parentPath: contextMenu.node!.path,
                    })
                    setContextMenu({ open: false, x: 0, y: 0, node: null })
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                  disabled={isCreating}
                >
                  <FilePlusIcon className="h-4 w-4" />
                  New File
                </button>
                <button
                  onClick={() => {
                    setNewItemDialog({
                      open: true,
                      type: "directory",
                      parentPath: contextMenu.node!.path,
                    })
                    setContextMenu({ open: false, x: 0, y: 0, node: null })
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                  disabled={isCreating}
                >
                  <FolderPlusIcon className="h-4 w-4" />
                  New Folder
                </button>
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
