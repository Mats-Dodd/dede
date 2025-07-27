import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useEffect, useState } from "react"

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
  const [titleValue, setTitleValue] = useState(title || "")

  // Use the content if provided, otherwise show default message
  // Handle null, undefined, and empty string cases
  const editorContent =
    content !== null && content !== undefined && content !== ""
      ? content
      : "<p>Start typing to add content...</p>"

  const editor = useEditor({
    extensions,
    content: editorContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onContentChange?.(html)
    },
  })

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && editorContent !== editor.getHTML()) {
      editor.commands.setContent(editorContent)
    }
  }, [content, editorContent, editor])

  // Update title when prop changes
  useEffect(() => {
    setTitleValue(title || "")
  }, [title])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitleValue(newTitle)
    onTitleChange?.(newTitle)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <input
            type="text"
            value={titleValue}
            onChange={handleTitleChange}
            placeholder="Untitled"
            className="w-full text-3xl font-bold border-none outline-none bg-transparent mb-6 placeholder-gray-400 resize-none"
            style={{ fontFamily: "inherit" }}
          />
          <div className="prose prose-lg max-w-none prose-headings:border-none prose-p:border-none [&_.ProseMirror]:border-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:bg-transparent">
            <EditorContent
              editor={editor}
              className="min-h-96 [&_.ProseMirror]:border-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:shadow-none [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:p-0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Tiptap
