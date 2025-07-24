import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import {
  todoCollection,
  projectCollection,
  usersCollection,
  fileSystemNodeCollection,
} from "@/lib/collections"
import { type Todo, type FileSystemNode } from "@/db/schema"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_authenticated/project/$projectId")({
  component: ProjectPage,
  ssr: false,
  loader: async () => {
    await projectCollection.preload()
    await todoCollection.preload()
    await fileSystemNodeCollection.preload()
    return null
  },
})

function ProjectPage() {
  const { projectId } = Route.useParams()
  const { data: session } = authClient.useSession()
  const [newTodoText, setNewTodoText] = useState("")

  console.log("[DEBUG] ProjectPage render - projectId:", projectId)
  console.log("[DEBUG] Session:", session)

  // File system node form state
  const [newNodePath, setNewNodePath] = useState("")
  const [newNodeName, setNewNodeName] = useState("")
  const [newNodeType, setNewNodeType] = useState("file")
  const [newNodeContent, setNewNodeContent] = useState("")
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    path: "",
    name: "",
    type: "file",
    content: "",
  })

  const { data: todos } = useLiveQuery(
    (q) =>
      q
        .from({ todoCollection })
        .where(({ todoCollection }) =>
          eq(todoCollection.projectId, parseInt(projectId, 10))
        )
        .orderBy(({ todoCollection }) => todoCollection.createdAt),
    [projectId]
  )
  console.log("[DEBUG] Todos query result:", todos)
  console.log(
    "[DEBUG] All todoCollection data:",
    Array.from(todoCollection.values())
  )

  const { data: fileSystemNodes } = useLiveQuery(
    (q) =>
      q
        .from({ fileSystemNodeCollection })
        .where(({ fileSystemNodeCollection }) =>
          eq(fileSystemNodeCollection.projectId, parseInt(projectId, 10))
        ),
    [projectId]
  )

  console.log("[DEBUG] fileSystemNodes from query:", fileSystemNodes)
  console.log(
    "[DEBUG] Raw fileSystemNodeCollection data:",
    JSON.stringify(fileSystemNodeCollection, null, 2)
  )

  const { data: users } = useLiveQuery((q) =>
    q.from({ users: usersCollection })
  )
  console.log("[DEBUG] Users query result:", users)
  console.log(
    "[DEBUG] All usersCollection data:",
    Array.from(usersCollection.values())
  )
  const { data: usersInProjects } = useLiveQuery(
    (q) =>
      q
        .from({ projects: projectCollection })
        .where(({ projects }) => eq(projects.id, parseInt(projectId, 10)))
        .fn.select(({ projects }) => ({
          users: projects.sharedUserIds.concat(projects.ownerId),
          owner: projects.ownerId,
        })),
    [projectId]
  )
  const usersInProject = usersInProjects?.[0]
  console.log({ usersInProject, users })

  const { data: projects } = useLiveQuery(
    (q) =>
      q
        .from({ projectCollection })
        .where(({ projectCollection }) =>
          eq(projectCollection.id, parseInt(projectId, 10))
        ),
    [projectId]
  )
  console.log("[DEBUG] Projects query result:", projects)
  console.log(
    "[DEBUG] All projectCollection data:",
    Array.from(projectCollection.values())
  )
  const project = projects?.[0]
  console.log("[DEBUG] Selected project:", project)

  const addTodo = () => {
    if (newTodoText.trim() && session) {
      todoCollection.insert({
        userId: session.user.id,
        id: Math.floor(Math.random() * 100000),
        text: newTodoText.trim(),
        completed: false,
        projectId: parseInt(projectId),
        userIds: [],
        createdAt: new Date(),
      })
      setNewTodoText("")
    }
  }

  const toggleTodo = (todo: Todo) => {
    todoCollection.update(todo.id, (draft) => {
      draft.completed = !draft.completed
    })
  }

  const deleteTodo = (id: number) => {
    todoCollection.delete(id)
  }

  // File system node CRUD operations
  const addFileSystemNode = () => {
    if (newNodePath.trim() && newNodeName.trim() && project) {
      fileSystemNodeCollection.insert({
        id: Math.floor(Math.random() * 100000),
        projectId: parseInt(projectId, 10),
        path: newNodePath.trim(),
        name: newNodeName.trim(),
        type: newNodeType,
        content: newNodeContent.trim() || null,
        metadata: {},
        isDeleted: false,
        userIds: [project.ownerId, ...project.sharedUserIds],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      // Reset form
      setNewNodePath("")
      setNewNodeName("")
      setNewNodeType("file")
      setNewNodeContent("")
    }
  }

  const startEditingNode = (node: FileSystemNode) => {
    setEditingNodeId(node.id)
    setEditForm({
      path: node.path,
      name: node.name,
      type: node.type,
      content: node.content || "",
    })
  }

  const saveNodeEdit = () => {
    if (editingNodeId && editForm.path.trim() && editForm.name.trim()) {
      fileSystemNodeCollection.update(editingNodeId, (draft) => {
        draft.path = editForm.path.trim()
        draft.name = editForm.name.trim()
        draft.type = editForm.type
        draft.content = editForm.content.trim() || null
        draft.updatedAt = new Date()
      })
      setEditingNodeId(null)
      setEditForm({
        path: "",
        name: "",
        type: "file",
        content: "",
      })
    }
  }

  const cancelEdit = () => {
    setEditingNodeId(null)
    setEditForm({
      path: "",
      name: "",
      type: "file",
      content: "",
    })
  }

  const deleteFileSystemNode = (id: number) => {
    fileSystemNodeCollection.delete(id)
  }

  if (!project) {
    return <div className="p-6">Project not found</div>
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <h1
          className="text-2xl font-bold text-gray-800 mb-2 cursor-pointer hover:bg-gray-50 p-0 rounded"
          onClick={() => {
            const newName = prompt("Edit project name:", project.name)
            if (newName && newName !== project.name) {
              projectCollection.update(project.id, (draft) => {
                draft.name = newName
              })
            }
          }}
        >
          {project.name}
        </h1>

        <p
          className="text-gray-600 mb-3 cursor-pointer hover:bg-gray-50 p-0 rounded min-h-[1.5rem]"
          onClick={() => {
            const newDescription = prompt(
              "Edit project description:",
              project.description || ""
            )
            if (newDescription !== null) {
              projectCollection.update(project.id, (draft) => {
                draft.description = newDescription
              })
            }
          }}
        >
          {project.description || "Click to add description..."}
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            placeholder="Add a new todo..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button onClick={addTodo} variant="default">
            Add
          </Button>
        </div>

        <ul className="space-y-2">
          {todos?.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-md shadow-sm"
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span
                className={`flex-1 ${
                  todo.completed
                    ? "line-through text-gray-500"
                    : "text-gray-800"
                }`}
              >
                {todo.text}
              </span>
              <Button onClick={() => deleteTodo(todo.id)} variant="destructive">
                Delete
              </Button>
            </li>
          ))}
        </ul>

        {(!todos || todos.length === 0) && (
          <div className="text-center py-8">
            <p className="text-gray-500">No todos yet. Add one above!</p>
          </div>
        )}

        <hr className="my-8 border-gray-200" />

        {/* File System Nodes Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            File System Nodes
          </h3>

          {/* Add new node form */}
          <div className="mb-4 p-4 bg-gray-50 rounded-md">
            <h4 className="font-medium text-gray-700 mb-3">Add New Node</h4>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                type="text"
                value={newNodePath}
                onChange={(e) => setNewNodePath(e.target.value)}
                placeholder="Path (e.g., /src/components)"
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                placeholder="Name (e.g., Button.tsx)"
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                value={newNodeType}
                onChange={(e) => setNewNodeType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="file">File</option>
                <option value="directory">Directory</option>
              </select>
              <Button onClick={addFileSystemNode} variant="default">
                Add Node
              </Button>
            </div>
            <textarea
              value={newNodeContent}
              onChange={(e) => setNewNodeContent(e.target.value)}
              placeholder="Content (optional)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Display existing nodes */}
          <div className="space-y-2">
            {fileSystemNodes?.map((node) => (
              <div
                key={node.id}
                className="p-3 bg-white border border-gray-200 rounded-md shadow-sm"
              >
                {editingNodeId === node.id ? (
                  // Edit mode
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editForm.path}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            path: e.target.value,
                          }))
                        }
                        placeholder="Path"
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Name"
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <select
                      value={editForm.type}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="file">File</option>
                      <option value="directory">Directory</option>
                    </select>
                    <textarea
                      value={editForm.content}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          content: e.target.value,
                        }))
                      }
                      placeholder="Content"
                      rows={2}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={saveNodeEdit}
                        variant="default"
                        size="sm"
                      >
                        Save
                      </Button>
                      <Button onClick={cancelEdit} variant="outline" size="sm">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">
                          {node.name}
                        </span>
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          {node.type}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => startEditingNode(node)}
                          variant="outline"
                          size="sm"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => deleteFileSystemNode(node.id)}
                          variant="destructive"
                          size="sm"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Path:</strong> {node.path}
                    </p>
                    {node.content && (
                      <p className="text-sm text-gray-600">
                        <strong>Content:</strong>{" "}
                        {node.content.substring(0, 100)}
                        {node.content.length > 100 ? "..." : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {(!fileSystemNodes || fileSystemNodes.length === 0) && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No file system nodes yet. Add one above!
              </p>
            </div>
          )}
        </div>

        <hr className="my-8 border-gray-200" />

        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Project Members
          </h3>
          <div className="space-y-2">
            {(session?.user.id === project.ownerId
              ? users
              : users?.filter((user) => usersInProject?.users.includes(user.id))
            )?.map((user) => {
              const isInProject = usersInProject?.users.includes(user.id)
              const isOwner = user.id === usersInProject?.owner
              const canEditMembership = session?.user.id === project.ownerId
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2 bg-gray-50 rounded"
                >
                  {canEditMembership && (
                    <input
                      type="checkbox"
                      checked={isInProject}
                      onChange={() => {
                        console.log(`onChange`, { isInProject, isOwner })
                        if (isInProject && !isOwner) {
                          projectCollection.update(project.id, (draft) => {
                            draft.sharedUserIds = draft.sharedUserIds.filter(
                              (id) => id !== user.id
                            )
                          })
                        } else if (!isInProject) {
                          projectCollection.update(project.id, (draft) => {
                            draft.sharedUserIds.push(user.id)
                          })
                        }
                      }}
                      disabled={isOwner}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                  )}
                  <span className="flex-1 text-gray-800">{user.name}</span>
                  {isOwner && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      Owner
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
