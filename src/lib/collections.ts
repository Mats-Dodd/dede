import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { authClient } from "@/lib/auth-client"
import {
  selectTodoSchema,
  selectProjectSchema,
  selectUsersSchema,
  selectFileSystemNodeSchema,
} from "@/db/schema"
import { getClient } from "@/api-client"
const client = getClient()

export const usersCollection = createCollection(
  electricCollectionOptions({
    id: "users",
    shapeOptions: {
      url: new URL(
        `/api/users`,
        typeof window !== `undefined`
          ? window.location.origin
          : `http://localhost:5173`
      ).toString(),
      params: {
        table: "users",
        user_id: async () =>
          authClient
            .getSession()
            .then((session) => session.data?.user.id ?? ``),
      },
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectUsersSchema,
    getKey: (item) => item.id,
  })
)
export const projectCollection = createCollection(
  electricCollectionOptions({
    id: "projects",
    shapeOptions: {
      url: new URL(
        `/api/projects`,
        typeof window !== `undefined`
          ? window.location.origin
          : `http://localhost:5173`
      ).toString(),
      params: {
        table: "projects",
        user_id: async () =>
          authClient
            .getSession()
            .then((session) => session.data?.user.id ?? ``),
      },
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectProjectSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newProject } = transaction.mutations[0]
      const result = await client.api.projects.$post({
        json: {
          name: newProject.name,
          description: newProject.description,
          owner_id: newProject.owner_id,
          shared_user_ids: newProject.shared_user_ids,
        },
      })

      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedProject } = transaction.mutations[0]
      const result = await client.api.projects[":id"].$put({
        param: {
          id: updatedProject.id,
        },
        json: {
          name: updatedProject.name,
          description: updatedProject.description,
          shared_user_ids: updatedProject.shared_user_ids,
        },
      })
      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedProject } = transaction.mutations[0]
      const result = await client.api.projects[":id"].$delete({
        param: { id: deletedProject.id },
      })

      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
  })
)

export const fileSystemNodeCollection = createCollection(
  electricCollectionOptions({
    id: "fileSystemNodes",
    shapeOptions: {
      url: new URL(
        `/api/fileSystemNodes`,
        typeof window !== `undefined`
          ? window.location.origin
          : `http://localhost:5173`
      ).toString(),
      params: {
        table: "file_system_nodes",
        user_id: async () =>
          authClient
            .getSession()
            .then((session) => session.data?.user.id ?? ""),
      },
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectFileSystemNodeSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newFileSystemNode } = transaction.mutations[0]
      const result = await client.api.fileSystemNodes.$post({
        json: {
          name: newFileSystemNode.name,
          path: newFileSystemNode.path,
          type: newFileSystemNode.type,
          projectId: newFileSystemNode.projectId,
          user_ids: newFileSystemNode.user_ids,
        },
      })

      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedFileSystemNode } = transaction.mutations[0]
      const result = await client.api.fileSystemNodes[":id"].$put({
        param: { id: updatedFileSystemNode.id },
        json: {
          name: updatedFileSystemNode.name,
          path: updatedFileSystemNode.path,
          type: updatedFileSystemNode.type,
        },
      })

      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedFileSystemNode } = transaction.mutations[0]
      const result = await client.api.fileSystemNodes[":id"].$delete({
        param: { id: deletedFileSystemNode.id },
      })

      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
  })
)

export const todoCollection = createCollection(
  electricCollectionOptions({
    id: "todos",
    shapeOptions: {
      url: new URL(
        `/api/todos`,
        typeof window !== `undefined`
          ? window.location.origin
          : `http://localhost:5173`
      ).toString(),
      params: {
        table: "todos",
        // Set the user_id as a param as a cache buster for when
        // you log in and out to test different accounts.
        user_id: async () =>
          authClient.getSession().then((session) => session.data?.user.id)!,
      },
      parser: {
        // Parse timestamp columns into JavaScript Date objects
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectTodoSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newTodo } = transaction.mutations[0]
      const result = await client.api.todos.$post({
        json: {
          user_id: newTodo.user_id,
          text: newTodo.text,
          completed: newTodo.completed,
          project_id: newTodo.project_id,
        },
      })

      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedTodo } = transaction.mutations[0]
      const result = await client.api.todos[":id"].$put({
        param: {
          id: updatedTodo.id,
        },
        json: {
          text: updatedTodo.text,
          completed: updatedTodo.completed,
        },
      })
      if (result.ok) {
        const data = await result.json()
        console.log(data, typeof data.txid)
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedTodo } = transaction.mutations[0]
      const result = await client.api.todos[":id"].$delete({
        param: { id: deletedTodo.id },
      })

      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
  })
)
