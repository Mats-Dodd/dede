import { useFileNodeByPath } from "@/lib/hooks/use-file-node"
import { useRef, useEffect, useState } from "react"
import { LoroDoc } from "loro-crdt"
import { TabsContent } from "@/components/ui/tabs"
import Tiptap from "@/components/editor"
import {
  base64ToBytes,
  bytesToBase64,
  loroExportSnapshot,
  loroExportUpdate,
} from "@/types/crdt"
import type { Base64String, LoroVersion } from "@/types/crdt"
export default function FileEditorPane({
  filePath,
}: {
  filePath: string
  key?: string
}) {
  const { node, setTitle, setMetadata, setContentCRDT } =
    useFileNodeByPath(filePath)
  const [loroDoc, setLoroDoc] = useState<LoroDoc | null>(null)
  const lastSavedRef = useRef<Base64String | null>(null)
  const lastVersionRef = useRef<LoroVersion | null>(null)
  const lastImportedUpdateHashRef = useRef<string | null>(null)
  const hasImportedSnapshotRef = useRef<boolean>(false)
  const importedSnapshotVersionRef = useRef<LoroVersion | null>(null)

  // Initialize LoroDoc instance for this pane
  useEffect(() => {
    if (!loroDoc) {
      const d = new LoroDoc()
      setLoroDoc(d)
      try {
        lastVersionRef.current = d.version()
      } catch (_e) {
        void _e
      }
      console.log("[Loro] Created LoroDoc", { filePath })
    }
  }, [loroDoc, filePath])

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
      const verBefore = (() => {
        try {
          return loroDoc.version()
        } catch {
          return null
        }
      })()
      console.log("[Loro] Importing snapshot from DB", {
        filePath,
        nodeId: node.id,
        base64Length: base64.length,
        bytesLength: bytes.length,
        verBefore,
      })
      loroDoc.import(bytes)
      try {
        const verAfter = loroDoc.version()
        lastVersionRef.current = verAfter
        hasImportedSnapshotRef.current = true
        importedSnapshotVersionRef.current =
          node.metadata?.loroVersion ?? verAfter
        console.log("[Loro] Snapshot import complete", { verAfter })
      } catch (_e) {
        void _e
      }
    } catch (e) {
      console.warn("[Loro] Import failed", e)
    }
  }, [node?.id, node?.contentCRDT, loroDoc, filePath])

  // Import remote incremental update if present
  useEffect(() => {
    if (!node || !loroDoc) return
    const meta = node.metadata ?? {}
    const updateBase64 = meta.loroUpdate as Base64String | undefined
    const updateHash = meta.loroHash as string | undefined
    const snapshotPresent = Boolean(node.contentCRDT)
    if (!updateBase64 || updateBase64.length === 0) return
    // Ensure we import snapshot first for consistent state
    if (!snapshotPresent || !hasImportedSnapshotRef.current) return
    if (updateHash && updateHash === lastImportedUpdateHashRef.current) return
    try {
      const bytes = base64ToBytes(updateBase64)
      const verBefore = (() => {
        try {
          return loroDoc.version()
        } catch {
          return null
        }
      })()
      console.log("[Loro] Importing incremental update from DB", {
        filePath,
        nodeId: node.id,
        updateBytes: bytes.length,
        updateHash,
        verBefore,
      })
      loroDoc.import(bytes)
      // Advance local trackers
      try {
        const verAfter = loroDoc.version()
        lastVersionRef.current = verAfter
        console.log("[Loro] Update import complete", { verAfter })
      } catch (_e) {
        void _e
      }
      if (updateHash) {
        lastImportedUpdateHashRef.current = updateHash
      }
    } catch (e) {
      console.warn("[Loro] Update import failed", e)
    }
  }, [
    node?.id,
    node?.metadata?.loroUpdate,
    node?.metadata?.loroHash,
    loroDoc,
    filePath,
  ])

  if (!node) return null

  return (
    <TabsContent value={filePath} className="flex-1 mt-0 border-0">
      <Tiptap
        title={node.title ?? "Untitled"}
        loroDoc={loroDoc}
        onTitleChange={setTitle}
        onDirty={() => {
          if (!loroDoc) return
          const from = lastVersionRef.current
          const toVersion = (() => {
            try {
              return loroDoc.version()
            } catch {
              return null
            }
          })()
          console.log("[Loro] Preparing export", { from, toVersion })

          // If we have no persisted snapshot yet, take one now to make reload durable
          const currentSnapshotBase64 = node?.contentCRDT as Base64String | null
          if (!currentSnapshotBase64 || currentSnapshotBase64.length === 0) {
            const snapBytes = loroExportSnapshot(loroDoc)
            const snapBase64 = bytesToBase64(snapBytes)
            console.log("[Loro] Initial snapshot -> persisting contentCRDT", {
              filePath,
              nodeId: node.id,
              bytesLength: snapBytes.length,
            })
            setContentCRDT(snapBase64)
            // After snapshot export, record local version for subsequent updates
            try {
              importedSnapshotVersionRef.current = loroDoc.version()
            } catch (_e) {
              void _e
            }
            hasImportedSnapshotRef.current = true
            lastSavedRef.current = snapBase64
            lastVersionRef.current =
              importedSnapshotVersionRef.current ?? lastVersionRef.current
            return
          }

          // Export cumulative updates from the locally recorded snapshot version (do not use JSON-ified versions)
          let updateBytes: Uint8Array | undefined
          try {
            updateBytes = importedSnapshotVersionRef.current
              ? loroExportUpdate(loroDoc, importedSnapshotVersionRef.current)
              : loroExportUpdate(loroDoc)
          } catch (e) {
            console.warn(
              "[Loro] Update export failed, falling back to snapshot",
              e
            )
            try {
              const snapBytes = loroExportSnapshot(loroDoc)
              const snapBase64 = bytesToBase64(snapBytes)
              setContentCRDT(snapBase64)
              try {
                importedSnapshotVersionRef.current = loroDoc.version()
              } catch (_e) {
                void _e
              }
              hasImportedSnapshotRef.current = true
              lastSavedRef.current = snapBase64
              lastVersionRef.current =
                importedSnapshotVersionRef.current ?? lastVersionRef.current
              return
            } catch (e2) {
              console.warn("[Loro] Snapshot export also failed", e2)
              return
            }
          }
          if (updateBytes && updateBytes.length > 0) {
            const updateBase64 = bytesToBase64(updateBytes)
            const updateHash = `${updateBase64.length}:${updateBase64.slice(0, 8)}:${updateBase64.slice(-8)}`
            console.log("[Loro] onDirty -> exporting update", {
              filePath,
              nodeId: node.id,
              from: importedSnapshotVersionRef.current,
              to: toVersion,
              updateBytes: updateBytes.length,
            })
            setMetadata({
              loroUpdate: updateBase64,
              loroUpdateToVersion: toVersion,
              loroHash: updateHash,
            })
            lastVersionRef.current = toVersion ?? lastVersionRef.current
          } else {
            console.log("[Loro] No update bytes to export", { from, toVersion })
          }
        }}
      />
    </TabsContent>
  )
}
