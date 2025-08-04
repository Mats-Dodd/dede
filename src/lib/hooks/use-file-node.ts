import { useCallback, useRef } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { eq } from "@tanstack/react-db"
import { fileSystemNodeCollection } from "@/lib/collections"

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
    (patch: Partial<typeof node>) => {
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

  return { node, setTitle, setContent }
}
