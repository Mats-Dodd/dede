import StarterKit from "@tiptap/starter-kit"
import { DiffDeleteMark, DiffExtension, DiffInsertMark } from "./diff-extension"
import { Extension } from "@tiptap/core"

export const baseExtensions = [
  StarterKit,
  DiffExtension,
  DiffInsertMark,
  DiffDeleteMark,
] as Extension[]
