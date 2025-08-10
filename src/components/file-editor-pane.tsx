import { useFileNodeByPath } from "@/lib/hooks/use-file-node"
import { useRef, useEffect, useCallback } from "react"
// LoroDoc type imported via hook return; no direct import needed here
import { TabsContent } from "@/components/ui/tabs"
import Tiptap from "@/components/editor"
import { base64ToBytes, bytesToBase64, loroExportSnapshot } from "@/types/crdt"
import type { Base64String } from "@/types/crdt"
import {
  useSharedLoroDoc,
  beginRemoteApply,
  endRemoteApply,
  isRemoteApplying,
  setDocLastSavedBase64,
  getDocLastSavedBase64,
} from "@/lib/loro-doc-registry"
export default function FileEditorPane({
  filePath,
}: {
  filePath: string
  key?: string
}) {
  const { node, setTitle, setContentCRDT } = useFileNodeByPath(filePath)
  const loroDoc = useSharedLoroDoc(filePath)
  const lastSavedRef = useRef<Base64String | null>(null)
  const snapshotTimeoutRef = useRef<number | null>(null)
  const flushSnapshot = useCallback(() => {
    if (!loroDoc || !node) return
    try {
      const snapBytes = loroExportSnapshot(loroDoc)
      const snapBase64 = bytesToBase64(snapBytes)
      if (snapBase64 !== lastSavedRef.current) {
        setContentCRDT(snapBase64)
        lastSavedRef.current = snapBase64
        console.log("[Loro] Snapshot flushed", {
          filePath,
          nodeId: node.id,
          bytesLength: snapBytes.length,
        })
      }
    } catch (e) {
      console.warn("[Loro] Snapshot flush failed", e)
    }
  }, [loroDoc, node, setContentCRDT, filePath])

  // loroDoc is provided by shared registry

  // Log node changes for debugging
  useEffect(() => {
    if (!node) return
    const meta = node.metadata ?? {}
    console.log("[Loro] Node changed", {
      filePath,
      nodeId: node.id,
      updatedAt: node.updatedAt,
      hasContentCRDT: Boolean(node.contentCRDT),
      meta,
    })
  }, [filePath, node?.id, node?.updatedAt, node?.contentCRDT, node?.metadata])

  // Import remote snapshot when contentCRDT changes
  useEffect(() => {
    if (!node || !loroDoc) return
    const base64 = node.contentCRDT as Base64String | null
    if (!base64) return
    if (base64 === lastSavedRef.current) return
    try {
      const bytes = base64ToBytes(base64)
      // Guard to prevent echo exports triggered by imports
      beginRemoteApply(filePath)
      loroDoc.import(bytes)
      endRemoteApply(filePath)
      lastSavedRef.current = base64
      setDocLastSavedBase64(filePath, base64)
      console.log("[Loro] Snapshot import complete", {
        filePath,
        nodeId: node.id,
        bytesLength: bytes.length,
      })
    } catch (e) {
      console.warn("[Loro] Import failed", e)
    }
  }, [node?.id, node?.contentCRDT, loroDoc, filePath])

  // Cleanup pending snapshot timer on unmount and flush snapshot
  useEffect(() => {
    const handleBeforeUnload = () => flushSnapshot()
    const handlePageHide = () => flushSnapshot()
    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("pagehide", handlePageHide)
    return () => {
      if (snapshotTimeoutRef.current) {
        clearTimeout(snapshotTimeoutRef.current)
        snapshotTimeoutRef.current = null
      }
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("pagehide", handlePageHide)
      flushSnapshot()
    }
  }, [flushSnapshot])

  if (!node) return null

  return (
    <TabsContent value={filePath} className="flex-1 mt-0 border-0">
      <Tiptap
        title={node.title ?? "Untitled"}
        loroDoc={loroDoc}
        onTitleChange={setTitle}
        onDirty={() => {
          if (!loroDoc) return
          if (isRemoteApplying(filePath)) return

          if (snapshotTimeoutRef.current) {
            clearTimeout(snapshotTimeoutRef.current)
          }
          snapshotTimeoutRef.current = window.setTimeout(() => {
            // Optionally defer heavy work to idle time
            const run = (fn: () => void) => {
              const ric = window.requestIdleCallback as
                | ((cb: () => void, opts?: { timeout?: number }) => number)
                | undefined
              if (ric) {
                ric(fn, { timeout: 500 })
              } else {
                // Fallback
                setTimeout(fn, 0)
              }
            }

            run(() => {
              try {
                const snapBytes = loroExportSnapshot(loroDoc)
                const snapBase64 = bytesToBase64(snapBytes)
                const lastSaved =
                  lastSavedRef.current ?? getDocLastSavedBase64(filePath)
                if (snapBase64 !== lastSaved) {
                  setContentCRDT(snapBase64)
                  lastSavedRef.current = snapBase64
                  setDocLastSavedBase64(filePath, snapBase64)
                  console.log("[Loro] Snapshot exported", {
                    filePath,
                    nodeId: node.id,
                    bytesLength: snapBytes.length,
                  })
                }
              } catch (e) {
                console.warn("[Loro] Snapshot export failed", e)
              }
            })
          }, 300)
        }}
      />
    </TabsContent>
  )
}
