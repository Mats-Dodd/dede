import { Extension, Mark } from "@tiptap/core"
import { Plugin } from "prosemirror-state"
import { Decoration, DecorationSet } from "prosemirror-view"
import type { JSONContent } from "@tiptap/core"
import {
  diffProseMirrorDocs,
  type DiffResult,
} from "@/lib/crdt/prosemirror-diff"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    diffView: {
      /**
       * Set diff content for comparison
       */
      setDiffContent: (
        leftDoc: JSONContent,
        rightDoc: JSONContent
      ) => ReturnType
      /**
       * Clear diff view
       */
      clearDiffView: () => ReturnType
      /**
       * Toggle diff visibility
       */
      toggleDiffView: (show: boolean) => ReturnType
    }
  }
}

export interface DiffExtensionOptions {
  showUnchanged: boolean
  highlightInsertions: boolean
  highlightDeletions: boolean
  insertClass: string
  deleteClass: string
  modifiedClass: string
}

export const DiffInsertMark = Mark.create({
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
        class: "diff-insert bg-green-100 text-green-900",
      },
      0,
    ]
  },
})

export const DiffDeleteMark = Mark.create({
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
        class: "diff-delete bg-red-100 text-red-900 line-through",
      },
      0,
    ]
  },
})

export const DiffExtension = Extension.create<DiffExtensionOptions>({
  name: "diffView",

  addOptions() {
    return {
      showUnchanged: true,
      highlightInsertions: true,
      highlightDeletions: true,
      insertClass: "bg-green-100 text-green-900",
      deleteClass: "bg-red-100 text-red-900 line-through",
      modifiedClass: "bg-yellow-50 border-l-4 border-yellow-400",
    }
  },

  addStorage() {
    return {
      diffResult: null as DiffResult | null,
      isDiffMode: false,
      decorations: DecorationSet.empty,
      leftDoc: null as JSONContent | null,
      rightDoc: null as JSONContent | null,
    }
  },

  addCommands() {
    return {
      setDiffContent:
        (leftDoc: JSONContent, rightDoc: JSONContent) =>
        ({ editor }) => {
          const diffResult = diffProseMirrorDocs(leftDoc, rightDoc)
          this.storage.diffResult = diffResult
          this.storage.isDiffMode = true

          // Store the comparison docs for reference
          this.storage.leftDoc = leftDoc
          this.storage.rightDoc = rightDoc

          // Force the editor to re-apply decorations
          editor.view.dispatch(editor.state.tr)

          return true
        },

      clearDiffView:
        () =>
        ({ editor, dispatch }) => {
          this.storage.diffResult = null
          this.storage.isDiffMode = false
          this.storage.decorations = DecorationSet.empty

          if (dispatch) {
            editor.view.updateState(editor.view.state)
          }

          return true
        },

      toggleDiffView:
        (show: boolean) =>
        ({ editor, dispatch }) => {
          this.storage.isDiffMode = show

          if (dispatch) {
            editor.view.updateState(editor.view.state)
          }

          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    const _options = this.options

    return [
      new Plugin({
        key: new Plugin("diffView"),

        state: {
          init() {
            return DecorationSet.empty
          },

          apply(_tr, _decorations, _oldState, newState) {
            if (!storage.isDiffMode || !storage.diffResult) {
              return DecorationSet.empty
            }

            // Create decorations based on diff result
            const decos: Decoration[] = []
            const diffNodes = storage.diffResult.nodes || []

            // Since we're showing the CURRENT document (right side of diff),
            // we need to apply decorations based on what's different from main

            let nodeIndex = 0
            newState.doc.descendants((node, pos) => {
              // Skip doc node and text nodes
              if (node.type.name === "doc" || node.type.name === "text") return

              // Get the corresponding diff node
              if (nodeIndex < diffNodes.length) {
                const diffNode = diffNodes[nodeIndex]

                if (diffNode.type === "added") {
                  // Entire paragraph/node was added in current branch
                  decos.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      class: "bg-green-50 border-l-4 border-green-400 pl-2",
                      "data-diff": "added",
                    })
                  )
                } else if (diffNode.type === "modified" && diffNode.textDiffs) {
                  // Node exists in both, but content is different
                  // Apply decorations for text-level differences

                  for (const textDiff of diffNode.textDiffs) {
                    if (textDiff.type === "insert") {
                      // This text was added in the current branch
                      // The positions in textDiff are relative to the right (current) text
                      decos.push(
                        Decoration.inline(
                          pos + textDiff.start + 1, // +1 for node boundary
                          pos + textDiff.end + 1,
                          {
                            class: "bg-green-100 text-green-900 px-0.5 rounded",
                            "data-diff": "insert",
                          }
                        )
                      )
                    } else if (textDiff.type === "delete") {
                      // Text that was in main but removed in current
                      // Show as a widget at the position where it was deleted
                      decos.push(
                        Decoration.widget(
                          pos + textDiff.start + 1,
                          () => {
                            const span = document.createElement("span")
                            span.className =
                              "bg-red-100 text-red-900 line-through px-0.5 rounded"
                            span.textContent = textDiff.content
                            span.setAttribute("data-diff", "delete")
                            return span
                          },
                          { side: -1 }
                        )
                      )
                    }
                  }
                } else if (diffNode.type === "deleted") {
                  // This node exists in main but not in current
                  // Since we're showing current, we won't see this node
                  // We could add a placeholder to show something was deleted
                  console.log("Node was deleted from main:", diffNode.node)
                }
                // "unchanged" nodes get no decoration
              }

              // Increment for each content node
              if (
                node.type.name === "paragraph" ||
                node.type.name === "heading"
              ) {
                nodeIndex++
              }
            })

            return DecorationSet.create(newState.doc, decos)
          },
        },

        props: {
          decorations(state) {
            return this.getState(state)
          },

          // Make editor read-only in diff mode
          editable() {
            return !storage.isDiffMode
          },
        },
      }),
    ]
  },
})

/**
 * Helper function to apply diff highlighting to an existing document
 */
export function createDiffDocument(
  currentDoc: JSONContent,
  compareDoc: JSONContent
): { document: JSONContent; stats: DiffResult["stats"] } {
  const diffResult = diffProseMirrorDocs(currentDoc, compareDoc)

  // Create a new document with diff annotations
  const diffDocument: JSONContent = {
    type: "doc",
    content: [],
  }

  for (const diffNode of diffResult.nodes) {
    const node = { ...diffNode.node }

    // Add visual indicators based on diff type
    if (diffNode.type === "added") {
      // Wrap added content
      diffDocument.content?.push({
        type: "paragraph",
        attrs: { diffType: "added" },
        content: node.content || [{ type: "text", text: "[Added content]" }],
      })
    } else if (diffNode.type === "deleted") {
      // Show deleted content with strikethrough
      diffDocument.content?.push({
        type: "paragraph",
        attrs: { diffType: "deleted" },
        content: node.content || [{ type: "text", text: "[Deleted content]" }],
      })
    } else if (diffNode.type === "modified") {
      // Show modified content with highlights
      diffDocument.content?.push({
        ...node,
        attrs: { ...node.attrs, diffType: "modified" },
      })
    } else {
      // Unchanged content
      diffDocument.content?.push(node)
    }
  }

  return {
    document: diffDocument,
    stats: diffResult.stats,
  }
}
