import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useEffect, useState, useRef } from "react"

const extensions = [StarterKit]

interface TiptapProps {
  title?: string
  content?: string
  onTitleChange?: (title: string) => void
  onContentChange?: (content: string) => void
}

const Tiptap = ({
  title,
  content,
  onTitleChange,
  onContentChange,
}: TiptapProps) => {
  const lastSyncedHtml = useRef<string>(content ?? "")
  const [titleValue, setTitleValue] = useState(title || "")

  const editorContent =
    content !== null && content !== undefined && content !== ""
      ? content
      : "<p>Start typing to add content...</p>"

  const editor = useEditor({
    extensions,
    content: editorContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (html === lastSyncedHtml.current) return
      lastSyncedHtml.current = html
      onContentChange?.(html)
    },
  })

  useEffect(() => {
    if (editor && editorContent !== editor.getHTML()) {
      lastSyncedHtml.current = editorContent
      editor.commands.setContent(editorContent)
    }
  }, [content, editorContent, editor])

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
