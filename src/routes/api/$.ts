import { createServerFileRoute } from "@tanstack/react-start/server"
import { OpenAPIHono } from "@hono/zod-openapi"
import { createCRUDRoutes } from "@/lib/createCRUDRoutes"
import {
  todosTable,
  selectTodoSchema,
  createTodoSchema,
  updateTodoSchema,
  projectsTable,
  selectProjectSchema,
  createProjectSchema,
  updateProjectSchema,
  fileSystemNodes,
  selectFileSystemNodeSchema,
  createFileSystemNodeSchema,
  updateFileSystemNodeSchema,
} from "@/db/schema"
import { users } from "@/db/auth-schema"
import { eq, sql } from "drizzle-orm"

const routes = [
  createCRUDRoutes({
    table: projectsTable,
    schema: {
      select: selectProjectSchema,
      create: createProjectSchema,
      update: updateProjectSchema,
    },
    basePath: "/api/projects",
    syncFilter: (session) =>
      `"ownerId" = '${session.user.id}' OR '${session.user.id}' = ANY("sharedUserIds")`,
    access: {
      create: (session, data) => {
        if (data.ownerId === session.user.id) {
          return true
        } else {
          throw new Error(`You can only create projects you own`)
        }
      },
      update: (session, _id, _data) =>
        eq(projectsTable.ownerId, session.user.id),
      delete: (session, _id) => eq(projectsTable.ownerId, session.user.id),
    },
  }),
  createCRUDRoutes({
    table: todosTable,
    schema: {
      select: selectTodoSchema,
      create: createTodoSchema,
      update: updateTodoSchema,
    },
    basePath: "/api/todos",
    syncFilter: (session) => `'${session.user.id}' = ANY("userIds")`,
    access: {
      create: (_session, _data) => true,
      update: (session, _id, _data) => eq(todosTable.userId, session.user.id),
      delete: (session, _id) => eq(todosTable.userId, session.user.id),
    },
  }),
  createCRUDRoutes({
    table: fileSystemNodes,
    schema: {
      select: selectFileSystemNodeSchema,
      create: createFileSystemNodeSchema,
      update: updateFileSystemNodeSchema,
    },
    basePath: "/api/fileSystemNodes",
    syncFilter: (session) => `'${session.user.id}' = ANY("userIds")`,
    access: {
      create: (_session, _data) => true,
      update: (session, _id, _data) => sql`${session.user.id} = ANY("userIds")`,
      delete: (session, _id) => sql`${session.user.id} = ANY("userIds")`,
    },
  }),
  // Add sync route - anyone authenticated can sync all users.
  // Not particularly secure of course but works for this demo.
  createCRUDRoutes({
    table: users,
    basePath: "/api/users",
    access: {
      create: () => {
        throw new Error(`Can't create new users through REST API`)
      },
      update: () => {
        throw new Error(`Can't edit users through REST API`)
      },
      delete: () => {
        throw new Error(`Can't delete users through REST API`)
      },
    },
  }),
] as const
const app = new OpenAPIHono()

routes.forEach((route) => app.route(`/`, route))

const serve = ({ request }: { request: Request }) => {
  return app.fetch(request)
}

export type AppType = (typeof routes)[number]

export const ServerRoute = createServerFileRoute("/api/$").methods({
  GET: serve,
  POST: serve,
  PUT: serve,
  DELETE: serve,
  PATCH: serve,
  OPTIONS: serve,
  HEAD: serve,
})
