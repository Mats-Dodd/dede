import {
  pgTable,
  integer,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core"
import { users } from "./auth-schema"
import { relations } from "drizzle-orm"

export const projectsTable = pgTable(`projects`, {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  shared_user_ids: text("shared_user_ids").array().notNull().default([]),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  owner_id: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
})

export const todosTable = pgTable(`todos`, {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  text: varchar({ length: 500 }).notNull(),
  completed: boolean().notNull().default(false),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  project_id: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  user_ids: text("user_ids").array().notNull().default([]),
})

export const fileSystemNodes = pgTable("file_system_nodes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id")
    .references(() => projectsTable.id, { onDelete: "cascade" })
    .notNull(),
  path: varchar("path", { length: 1000 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  content: text("content"),
  metadata: jsonb("metadata")
    .$type<{
      language?: string
      encoding?: string
      size?: number
      isHidden?: boolean
      [key: string]: unknown
    }>()
    .default({}),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  user_ids: text("user_ids").array().notNull().default([]),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const projectsRelations = relations(projectsTable, ({ many }) => ({
  fileSystemNodes: many(fileSystemNodes),
}))

export const fileSystemNodesRelations = relations(
  fileSystemNodes,
  ({ one }) => ({
    project: one(projectsTable, {
      fields: [fileSystemNodes.projectId],
      references: [projectsTable.id],
    }),
  })
)
