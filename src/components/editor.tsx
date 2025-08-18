import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useEffect, useMemo, useState, memo, useCallback } from "react"
import type { LoroDoc } from "loro-crdt"
import { Extension, type JSONContent } from "@tiptap/core"
import { keymap } from "prosemirror-keymap"
import { LoroSyncPlugin, LoroUndoPlugin, undo, redo } from "loro-prosemirror"
import {
  DiffExtension,
  DiffInsertMark,
  DiffDeleteMark,
} from "@/lib/extensions/diff-extension"
// Note: avoid importing prosemirror-state types to prevent missing type decl errors

type EditorExtensions = NonNullable<
  Parameters<typeof useEditor>[0]
>["extensions"]

interface TiptapProps {
  title?: string
  loroDoc?: LoroDoc | null
  onTitleChange?: (title: string) => void
  onDirty?: () => void
  diffMode?: boolean
  diffContent?: JSONContent | null
  onExitDiffMode?: () => void
}

const Tiptap = ({
  title,
  loroDoc,
  onTitleChange,
  onDirty,
  diffMode,
  diffContent,
  onExitDiffMode,
}: TiptapProps) => {
  const [titleValue, setTitleValue] = useState(title || "")

  const editorExtensions = useMemo(() => {
    // Always include diff extensions so commands are available
    const baseExtensions = [
      StarterKit,
      DiffExtension,
      DiffInsertMark,
      DiffDeleteMark,
    ] as Extension[]

    // Add Loro sync to keep content available
    if (loroDoc) {
      baseExtensions.push(
        Extension.create({
          name: "loro",
          addProseMirrorPlugins() {
            return [
              LoroSyncPlugin({
                doc: loroDoc as unknown as Parameters<
                  typeof LoroSyncPlugin
                >[0]["doc"],
              }),
              LoroUndoPlugin({
                doc: loroDoc as unknown as Parameters<
                  typeof LoroUndoPlugin
                >[0]["doc"],
              }),
              keymap({ "Mod-z": undo, "Mod-y": redo, "Mod-Shift-z": redo }),
            ]
          },
        })
      )
    }

    return baseExtensions
  }, [loroDoc, diffMode])

  const editor = useEditor(
    {
      extensions: editorExtensions as unknown as EditorExtensions,
      onCreate: () => {},
      onUpdate: () => {
        if (!diffMode) {
          onDirty?.()
        }
      },
      editable: !diffMode,
    },
    [loroDoc, diffMode]
  )

  // Apply diff content when entering diff mode
  useEffect(() => {
    if (editor && diffMode && diffContent) {
      // Small delay to ensure content is synced
      const timer = setTimeout(() => {
        // Get the current content from the editor (from current branch)
        const currentContent = editor.getJSON()
        console.log("Current branch content:", currentContent)
        console.log("Main branch content (for comparison):", diffContent)

        // Check if the diff commands are available
        if (editor.commands.setDiffContent) {
          // Pass main (diffContent) as left (base) and current as right (new)
          // This shows what's been added/changed in current branch compared to main
          editor.commands.setDiffContent(diffContent, currentContent)
        }
      }, 100)

      return () => clearTimeout(timer)
    } else if (editor && !diffMode) {
      // Check if the diff commands are available
      if (editor.commands.clearDiffView) {
        editor.commands.clearDiffView()
      }
    }
  }, [editor, diffMode, diffContent])

  useEffect(() => {
    setTitleValue(title || "")
  }, [title])

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value
      setTitleValue(newTitle)
      onTitleChange?.(newTitle)
    },
    [onTitleChange]
  )

  return (
    <div className="h-full flex justify-center py-12">
      <div className="w-full max-w-2xl h-full flex flex-col">
        {diffMode && onExitDiffMode && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-yellow-800">
              Viewing differences (read-only mode)
            </span>
            <button
              onClick={onExitDiffMode}
              className="text-sm px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Exit Diff View
            </button>
          </div>
        )}
        <input
          type="text"
          value={titleValue}
          onChange={handleTitleChange}
          placeholder="Untitled"
          disabled={diffMode}
          className="w-full text-4xl font-bold border-none outline-none bg-transparent mb-12 placeholder-gray-400 resize-none leading-tight disabled:opacity-50"
          style={{ fontFamily: "inherit" }}
        />
        <div className="flex-1 prose prose-xl max-w-none prose-headings:border-none prose-p:border-none prose-p:leading-relaxed prose-headings:leading-tight [&_.ProseMirror]:border-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:leading-relaxed">
          <EditorContent
            editor={editor}
            className="h-full [&_.ProseMirror]:border-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:shadow-none [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:p-0 [&_.ProseMirror]:h-full [&_.ProseMirror]:text-lg [&_.ProseMirror]:leading-relaxed [&_.ProseMirror_p]:mb-6"
          />
        </div>
      </div>
    </div>
  )
}

export default memo(Tiptap)
