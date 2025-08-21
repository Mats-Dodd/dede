import { createSchemaFactory } from "drizzle-zod"
import { z } from "@hono/zod-openapi"
import { users } from "./auth-schema"
import {
  fileSystemNodes,
  projectsTable,
  todosTable,
  chats,
  messages,
  messageParts,
} from "./app-schema"

const { createInsertSchema, createSelectSchema, createUpdateSchema } =
  createSchemaFactory({ zodInstance: z })

export const selectProjectSchema = createSelectSchema(projectsTable)
export const createProjectSchema = createInsertSchema(projectsTable)
  .omit({
    createdAt: true,
  })
  .openapi(`CreateProject`)
export const updateProjectSchema = createUpdateSchema(projectsTable)

export const selectTodoSchema = createSelectSchema(todosTable)
export const createTodoSchema = createInsertSchema(todosTable)
  .omit({
    createdAt: true,
  })
  .openapi(`CreateTodo`)
export const updateTodoSchema = createUpdateSchema(todosTable)

export const selectFileSystemNodeSchema = createSelectSchema(fileSystemNodes)
export const createFileSystemNodeSchema = createInsertSchema(fileSystemNodes)
  .omit({
    createdAt: true,
  })
  .openapi(`CreateFileSystemNode`)
export const updateFileSystemNodeSchema = createUpdateSchema(fileSystemNodes)

export type Project = z.infer<typeof selectProjectSchema>
export type UpdateProject = z.infer<typeof updateProjectSchema>
export type Todo = z.infer<typeof selectTodoSchema>
export type UpdateTodo = z.infer<typeof updateTodoSchema>
export type FileSystemNode = z.infer<typeof selectFileSystemNodeSchema>
export type UpdateFileSystemNode = z.infer<typeof updateFileSystemNodeSchema>

export const selectChatSchema = createSelectSchema(chats)
export const createChatSchema = createInsertSchema(chats)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .openapi(`CreateChat`)
export const updateChatSchema = createUpdateSchema(chats)

export const selectMessageSchema = createSelectSchema(messages)
export const createMessageSchema = createInsertSchema(messages)
  .omit({
    createdAt: true,
  })
  .openapi(`CreateMessage`)
export const updateMessageSchema = createUpdateSchema(messages)

export const selectMessagePartSchema = createSelectSchema(messageParts)
export const createMessagePartSchema = createInsertSchema(messageParts)
  .omit({
    createdAt: true,
  })
  .openapi(`CreateMessagePart`)
export const updateMessagePartSchema = createUpdateSchema(messageParts)

export const selectUsersSchema = createSelectSchema(users)

export type Chat = z.infer<typeof selectChatSchema>
export type UpdateChat = z.infer<typeof updateChatSchema>
export type Message = z.infer<typeof selectMessageSchema>
export type UpdateMessage = z.infer<typeof updateMessageSchema>
export type MessagePart = z.infer<typeof selectMessagePartSchema>
export type UpdateMessagePart = z.infer<typeof updateMessagePartSchema>

export { users, sessions, accounts, verifications } from "./auth-schema"
export {
  projectsTable,
  todosTable,
  fileSystemNodes,
  chats,
  messages,
  messageParts,
} from "./app-schema"
