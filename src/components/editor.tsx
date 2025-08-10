import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useEffect, useState } from "react"
import type { LoroDoc } from "loro-crdt"
import { Extension } from "@tiptap/core"
import { keymap } from "prosemirror-keymap"
import { LoroSyncPlugin, LoroUndoPlugin, undo, redo } from "loro-prosemirror"
// Note: avoid importing prosemirror-state types to prevent missing type decl errors

type EditorExtensions = NonNullable<
  Parameters<typeof useEditor>[0]
>["extensions"]

interface TiptapProps {
  title?: string
  loroDoc?: LoroDoc | null
  onTitleChange?: (title: string) => void
  onDirty?: () => void
}

const Tiptap = ({ title, loroDoc, onTitleChange, onDirty }: TiptapProps) => {
  const [titleValue, setTitleValue] = useState(title || "")

  const editorExtensions = loroDoc
    ? [
        StarterKit as unknown as Extension,
        Extension.create({
          name: "loro",
          addProseMirrorPlugins() {
            console.log("[Editor] Adding Loro plugins", { hasLoro: !!loroDoc })
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
        }),
      ]
    : [StarterKit as unknown as Extension]

  const editor = useEditor(
    {
      extensions: editorExtensions as unknown as EditorExtensions,
      onCreate: () => {
        console.log("[Editor] created", { hasLoro: !!loroDoc })
      },
      onUpdate: ({ editor }) => {
        const text = editor.state.doc.textContent
        console.log("[Editor] onUpdate", { length: text.length })
        onDirty?.()
      },
    },
    [loroDoc]
  )

  useEffect(() => {
    setTitleValue(title || "")
  }, [title])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitleValue(newTitle)
    onTitleChange?.(newTitle)
  }

  return (
    <div className="h-full flex justify-center py-12">
      <div className="w-full max-w-2xl h-full flex flex-col">
        <input
          type="text"
          value={titleValue}
          onChange={handleTitleChange}
          placeholder="Untitled"
          className="w-full text-4xl font-bold border-none outline-none bg-transparent mb-12 placeholder-gray-400 resize-none leading-tight"
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

export default Tiptap
