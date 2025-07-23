import { createSchemaFactory } from "drizzle-zod"
import { z } from "@hono/zod-openapi"
import { users } from "./auth-schema"
import { projectsTable, todosTable } from "./app-schema"

const { createInsertSchema, createSelectSchema, createUpdateSchema } =
  createSchemaFactory({ zodInstance: z })

export const selectProjectSchema = createSelectSchema(projectsTable)
export const createProjectSchema = createInsertSchema(projectsTable)
  .omit({
    created_at: true,
  })
  .openapi(`CreateProject`)
export const updateProjectSchema = createUpdateSchema(projectsTable)

export const selectTodoSchema = createSelectSchema(todosTable)
export const createTodoSchema = createInsertSchema(todosTable)
  .omit({
    created_at: true,
  })
  .openapi(`CreateTodo`)
export const updateTodoSchema = createUpdateSchema(todosTable)

export type Project = z.infer<typeof selectProjectSchema>
export type UpdateProject = z.infer<typeof updateProjectSchema>
export type Todo = z.infer<typeof selectTodoSchema>
export type UpdateTodo = z.infer<typeof updateTodoSchema>

export const selectUsersSchema = createSelectSchema(users)

export { users, sessions, accounts, verifications } from "./auth-schema"
export { projectsTable, todosTable } from "./app-schema"
