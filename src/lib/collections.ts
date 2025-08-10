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
    getKey: (item) => item.id.toString(),
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
    getKey: (item) => item.id.toString(),
    onInsert: async ({ transaction }) => {
      const { modified: newProject } = transaction.mutations[0]
      // @ts-expect-error - API types not properly generated yet
      const result = await client.api.projects.$post({
        json: {
          name: newProject.name,
          description: newProject.description,
          ownerId: newProject.ownerId,
          sharedUserIds: newProject.sharedUserIds,
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
      // @ts-expect-error - API types not properly generated yet
      const result = await client.api.projects[":id"].$put({
        param: {
          id: updatedProject.id,
        },
        json: {
          name: updatedProject.name,
          description: updatedProject.description,
          sharedUserIds: updatedProject.sharedUserIds,
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
      // @ts-expect-error - API types not properly generated yet
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
        table: '"fileSystemNodes"',
        user_id: async () =>
          authClient
            .getSession()
            .then((session) => session.data?.user.id ?? ""),
        // Cache buster to force new handle after sync filter change
        v: "6",
      },
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectFileSystemNodeSchema,
    getKey: (item) => item.id.toString(),
    onInsert: async ({ transaction }) => {
      const { modified: newFileSystemNode } = transaction.mutations[0]
      // @ts-expect-error - API types not properly generated yet
      const result = await client.api.fileSystemNodes.$post({
        json: {
          path: newFileSystemNode.path,
          content: newFileSystemNode.content,
          title: newFileSystemNode.title,
          type: newFileSystemNode.type,
          projectId: newFileSystemNode.projectId,
          userIds: newFileSystemNode.userIds,
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
      // @ts-expect-error - API types not properly generated yet
      const result = await client.api.fileSystemNodes[":id"].$put({
        param: { id: updatedFileSystemNode.id },
        json: {
          content: updatedFileSystemNode.content,
          title: updatedFileSystemNode.title,
          path: updatedFileSystemNode.path,
          type: updatedFileSystemNode.type,
          contentCRDT: updatedFileSystemNode.contentCRDT,
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
      // @ts-expect-error - API types not properly generated yet

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
        // @ts-expect-error - Type mismatch with param value type
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
    getKey: (item) => item.id.toString(),
    onInsert: async ({ transaction }) => {
      const { modified: newTodo } = transaction.mutations[0]
      // @ts-expect-error - API types not properly generated yet
      const result = await client.api.todos.$post({
        json: {
          userId: newTodo.userId,
          text: newTodo.text,
          completed: newTodo.completed,
          projectId: newTodo.projectId,
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
      // @ts-expect-error - API types not properly generated yet
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
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedTodo } = transaction.mutations[0]
      // @ts-expect-error - API types not properly generated yet
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
