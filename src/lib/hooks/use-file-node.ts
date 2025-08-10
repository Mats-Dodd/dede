import { useCallback, useRef } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { eq } from "@tanstack/react-db"
import { fileSystemNodeCollection } from "@/lib/collections"
import type { FileSystemNode } from "@/db/schema"
import type { Base64String } from "@/types/crdt"

function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay = 400
): (...args: Args) => void {
  let t: ReturnType<typeof setTimeout>
  return (...args: Args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

export function useFileNode(fileId: string) {
  const { data } = useLiveQuery((q) =>
    q
      .from({ n: fileSystemNodeCollection })
      .where(({ n }) => eq(n.id, Number(fileId)))
  )
  const node = data?.[0]

  // updater helper
  const updateImmediate = useCallback(
    (patch: Partial<FileSystemNode>) => {
      fileSystemNodeCollection.update(fileId, (draft) => {
        Object.assign(draft, patch)
        draft.updatedAt = new Date()
      })
    },
    [fileId]
  )

  const debouncedUpdateTitle = useRef(
    debounce((t: string) => updateImmediate({ title: t }), 300)
  ).current

  const setTitle = useCallback(
    (t: string) => debouncedUpdateTitle(t),
    [debouncedUpdateTitle]
  )
  const setContent = useCallback(
    (html: string) => updateImmediate({ content: html }),
    [updateImmediate]
  )
  const setContentCRDT = useCallback(
    (base64: Base64String) => updateImmediate({ contentCRDT: base64 }),
    [updateImmediate]
  )
  const setMetadata = useCallback(
    (meta: Partial<FileSystemNode["metadata"]>) =>
      updateImmediate({
        metadata: {
          ...(node?.metadata ?? {}),
          ...meta,
        },
      } as Partial<FileSystemNode>),
    [updateImmediate, node]
  )

  return { node, setTitle, setContent, setContentCRDT, setMetadata }
}

export function useFileNodeByPath(filePath: string) {
  const { data } = useLiveQuery((q) =>
    q
      .from({ n: fileSystemNodeCollection })
      .where(({ n }) => eq(n.path, filePath))
  )
  const node = data?.[0]

  // updater helper
  const updateImmediate = useCallback(
    (patch: Partial<FileSystemNode>) => {
      if (!node) return
      fileSystemNodeCollection.update(node.id.toString(), (draft) => {
        Object.assign(draft, patch)
        draft.updatedAt = new Date()
      })
    },
    [node]
  )

  const debouncedUpdateTitle = useRef(
    debounce((t: string) => updateImmediate({ title: t }), 300)
  ).current

  const setTitle = useCallback(
    (t: string) => debouncedUpdateTitle(t),
    [debouncedUpdateTitle]
  )
  const setContent = useCallback(
    (html: string) => updateImmediate({ content: html }),
    [updateImmediate]
  )
  const setContentCRDT = useCallback(
    (base64: Base64String) => updateImmediate({ contentCRDT: base64 }),
    [updateImmediate]
  )
  const setMetadata = useCallback(
    (meta: Partial<FileSystemNode["metadata"]>) =>
      updateImmediate({
        metadata: {
          ...(node?.metadata ?? {}),
          ...meta,
        },
      } as Partial<FileSystemNode>),
    [updateImmediate, node]
  )

  return { node, setTitle, setContent, setContentCRDT, setMetadata }
}
