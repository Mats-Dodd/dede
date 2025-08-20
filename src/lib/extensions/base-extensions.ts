import StarterKit from "@tiptap/starter-kit"
import { DiffDeleteMark, DiffExtension, DiffInsertMark } from "./diff-extension"
import { Extension } from "@tiptap/core"
import Italic from "@tiptap/extension-italic"

export const baseExtensions = [
  StarterKit,
  DiffExtension,
  DiffInsertMark,
  DiffDeleteMark,
  Italic,
] as Extension[]
