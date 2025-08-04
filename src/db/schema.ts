import { createSchemaFactory } from "drizzle-zod"
import { z } from "@hono/zod-openapi"
import { users } from "./auth-schema"
import { fileSystemNodes, projectsTable, todosTable } from "./app-schema"

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

export const selectUsersSchema = createSelectSchema(users)

export { users, sessions, accounts, verifications } from "./auth-schema"
export { projectsTable, todosTable, fileSystemNodes } from "./app-schema"
