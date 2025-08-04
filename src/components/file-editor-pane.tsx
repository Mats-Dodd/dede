import { useLiveQuery, eq } from "@tanstack/react-db"
import { fileSystemNodeCollection } from "@/lib/collections"
import Tiptap from "@/components/editor"

/**
 * Simple wrapper that subscribes to a single fileSystemNode row and renders
 * the Tiptap editor wired up for live updates.
 */
export default function FileEditorPane({ fileId }: { fileId: string }) {
  const { data } = useLiveQuery((q) =>
    q
      .from({ n: fileSystemNodeCollection })
      .where(({ n }) => eq(n.id, Number(fileId)))
  )

  const node = data?.[0]
  if (!node) return null // loading or row not found yet

  return (
    <Tiptap
      fileId={fileId}
      title={node.title ?? "Untitled"}
      content={node.content ?? ""}
    />
  )
}
