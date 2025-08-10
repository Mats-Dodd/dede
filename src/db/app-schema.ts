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
  sharedUserIds: text("sharedUserIds").array().notNull().default([]),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  ownerId: text("ownerId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
})

export const todosTable = pgTable(`todos`, {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  text: varchar({ length: 500 }).notNull(),
  completed: boolean().notNull().default(false),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: integer("projectId")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  userIds: text("userIds").array().notNull().default([]),
})

export const fileSystemNodes = pgTable("fileSystemNodes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("projectId")
    .references(() => projectsTable.id, { onDelete: "cascade" })
    .notNull(),
  path: varchar("path", { length: 1000 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  contentCRDT: text("contentCRDT"),
  metadata: jsonb("metadata")
    .$type<{
      language?: string
      encoding?: string
      size?: number
      isHidden?: boolean
      [key: string]: unknown
    }>()
    .default({}),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  userIds: text("userIds").array().notNull().default([]),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
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
