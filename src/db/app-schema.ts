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
// Intentionally no imports; keep schema types minimal

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
  metadata: jsonb("metadata")
    // Keeping column for now, but we do not use strong typing anymore
    .$type<Record<string, unknown>>()
    .default({} as Record<string, unknown>),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  userIds: text("userIds").array().notNull().default([]),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const chats = pgTable("chats", {
  id: integer().primaryKey().notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  projectId: integer("projectId").references(() => projectsTable.id),
  systemPrompt: text("systemPrompt"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  archived: boolean("archived").default(false).notNull(),
})

export const messages = pgTable("messages", {
  id: integer().primaryKey().notNull(),
  chatId: integer("chatId")
    .references(() => chats.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system' | 'tool'
  content: text("content"), // Main text content
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const messageParts = pgTable("messageParts", {
  id: integer().primaryKey().notNull(),
  messageId: integer("messageId")
    .references(() => messages.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(), // 'text' | 'image' | 'file' | 'tool-call' | 'tool-result'
  content: text("content"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const projectsRelations = relations(projectsTable, ({ many }) => ({
  fileSystemNodes: many(fileSystemNodes),
  chats: many(chats),
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

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id],
  }),
  project: one(projectsTable, {
    fields: [chats.projectId],
    references: [projectsTable.id],
  }),
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  parts: many(messageParts),
}))

export const messagePartsRelations = relations(messageParts, ({ one }) => ({
  message: one(messages, {
    fields: [messageParts.messageId],
    references: [messages.id],
  }),
}))
