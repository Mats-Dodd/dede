"use client"

import React, { useState, useMemo } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { TreeView, type TreeDataItem } from "@/components/file-tree"
import { fileSystemNodeCollection, projectCollection } from "@/lib/collections"
import {
  transformFileSystemNodesToTree,
  createNewFileSystemNode,
  type FileTreeNode,
} from "@/lib/file-tree-utils"
import { useFileContext } from "@/lib/file-context"
import { type FileSystemNode } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { FolderPlusIcon, FilePlusIcon, TrashIcon, EditIcon } from "lucide-react"

interface ProjectFileTreeProps {
  projectId: number
}

export function ProjectFileTree({ projectId }: ProjectFileTreeProps) {
  const { selectedFileNode, setSelectedFileNode } = useFileContext()
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

  const { data: fileSystemNodes = [] } = useLiveQuery(
    (q) =>
      q
        .from({ fileSystemNodeCollection })
        .where(({ fileSystemNodeCollection }) =>
          eq(fileSystemNodeCollection.projectId, projectId)
        ),
    [projectId]
  )
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
      setSelectedFileNode(fileNode)
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

  const handleCreateItem = () => {
    if (!newItemName.trim() || !project) return

    const newNode = createNewFileSystemNode(
      projectId,
      newItemDialog.parentPath,
      newItemName.trim(),
      newItemDialog.type
    )

    fileSystemNodeCollection.insert({
      id: Math.floor(Math.random() * 100000),
      ...newNode,
      userIds: [project.ownerId, ...project.sharedUserIds],
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    setNewItemName("")
    setNewItemDialog({ open: false, type: "file", parentPath: "/" })
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
    const newPath = node.path.replace(
      new RegExp(`/${node.name}$`),
      `/${editForm.name.trim()}`
    )

    fileSystemNodeCollection.update(node.id.toString(), (draft) => {
      draft.name = editForm.name.trim()
      draft.path = newPath
      draft.content = editForm.content.trim() || null
      draft.updatedAt = new Date()
    })

    setEditDialog({ open: false, node: null })
    setEditForm({ name: "", content: "" })
  }

  const handleDelete = (node: FileSystemNode) => {
    fileSystemNodeCollection.delete(node.id.toString())
  }

  const renderContextMenuActions = (node: FileTreeNode) => (
    <>
      <ContextMenuItem
        onClick={() =>
          setNewItemDialog({
            open: true,
            type: "file",
            parentPath: node.type === "directory" ? node.path : "/",
          })
        }
        className="flex items-center gap-2"
      >
        <FilePlusIcon className="h-4 w-4" />
        New File
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() =>
          setNewItemDialog({
            open: true,
            type: "directory",
            parentPath: node.type === "directory" ? node.path : "/",
          })
        }
        className="flex items-center gap-2"
      >
        <FolderPlusIcon className="h-4 w-4" />
        New Folder
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => handleEdit(node.fileSystemNode)}
        className="flex items-center gap-2"
      >
        <EditIcon className="h-4 w-4" />
        Rename
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => handleDelete(node.fileSystemNode)}
        className="flex items-center gap-2 text-destructive"
      >
        <TrashIcon className="h-4 w-4" />
        Delete
      </ContextMenuItem>
    </>
  )

  const treeDataWithActions: TreeDataItem[] = useMemo(() => {
    const addActions = (nodes: FileTreeNode[]): TreeDataItem[] => {
      return nodes.map((node) => ({
        ...node,
        actions: (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <span className="inline-flex items-center justify-center h-6 w-6 text-xs cursor-pointer hover:bg-gray-100 rounded">
                •••
              </span>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {renderContextMenuActions(node)}
            </ContextMenuContent>
          </ContextMenu>
        ),
        children: node.children
          ? addActions(node.children as FileTreeNode[])
          : undefined,
      }))
    }
    return addActions(treeData)
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
            >
              <FolderPlusIcon className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {treeDataWithActions.length > 0 ? (
          <TreeView
            data={treeDataWithActions}
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
            <Button onClick={handleCreateItem}>Create</Button>
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
    </>
  )
}
