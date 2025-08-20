import StarterKit from "@tiptap/starter-kit"
import { DiffDeleteMark, DiffExtension, DiffInsertMark } from "./diff-extension"
import { Extension } from "@tiptap/core"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"

export const baseExtensions = [
  StarterKit,
  DiffExtension,
  DiffInsertMark,
  DiffDeleteMark,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
] as Extension[]
