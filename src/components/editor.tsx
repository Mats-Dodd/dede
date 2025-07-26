import { useEditor, EditorContent } from "@tiptap/react"
import { FloatingMenu, BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import { useEffect } from "react"

const extensions = [StarterKit]

interface TiptapProps {
  content?: string
  onContentChange?: (content: string) => void
}

const Tiptap = ({ content, onContentChange }: TiptapProps) => {
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 prose prose-sm max-w-none p-4">
        <EditorContent editor={editor} className="h-full" />
      </div>
      <FloatingMenu editor={editor}>
        <div className="bg-white border rounded-lg shadow-lg p-2 text-sm">
          This is the floating menu
        </div>
      </FloatingMenu>
      <BubbleMenu editor={editor}>
        <div className="bg-white border rounded-lg shadow-lg p-2 text-sm">
          This is the bubble menu
        </div>
      </BubbleMenu>
    </div>
  )
}

export default Tiptap
