import { Mark, Extension } from "@tiptap/core"
import { Plugin } from "@tiptap/pm/state"
import { DecorationSet } from "@tiptap/pm/view"
import type { JSONContent } from "@tiptap/core"
import { createMergedDocument } from "@/lib/crdt/prosemirror-diff"

export const DiffInsert = Mark.create({
  name: "diffInsert",

  addAttributes() {
    return {}
  },

  parseHTML() {
    return [
      {
        tag: "span[data-diff-insert]",
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        ...HTMLAttributes,
        "data-diff-insert": "",
        style: "background-color: #86efac; color: #166534;",
      },
      0,
    ]
  },
})

export const DiffDelete = Mark.create({
  name: "diffDelete",

  addAttributes() {
    return {}
  },

  parseHTML() {
    return [
      {
        tag: "span[data-diff-delete]",
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        ...HTMLAttributes,
        "data-diff-delete": "",
        style:
          "background-color: #fca5a5; color: #991b1b; text-decoration: line-through;",
      },
      0,
    ]
  },
})

export interface DiffViewOptions {
  leftDoc: JSONContent | null
  rightDoc: JSONContent | null
}

export const DiffView = Extension.create<DiffViewOptions>({
  name: "diffView",

  addOptions() {
    return {
      leftDoc: null,
      rightDoc: null,
    }
  },

  addExtensions() {
    return [DiffInsert, DiffDelete]
  },

  onCreate() {
    const { leftDoc, rightDoc } = this.options

    if (leftDoc && rightDoc && this.editor) {
      const mergedDoc = createMergedDocument(leftDoc, rightDoc)

      this.editor.commands.setContent(mergedDoc)

      this.editor.setEditable(false)
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: (_state) => {
            return DecorationSet.empty
          },
        },
      }),
    ]
  },

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          class: {
            default: null,
            renderHTML: (attributes) => {
              if (attributes.class?.includes("diff-")) {
                return {
                  class: attributes.class,
                }
              }
              return {}
            },
          },
        },
      },
    ]
  },
})
