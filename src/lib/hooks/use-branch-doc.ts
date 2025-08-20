import { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { LoroDoc } from "loro-crdt"
import type { Base64String } from "@/types/crdt"
import { bytesToBase64, loroExportSnapshot, base64ToBytes } from "@/types/crdt"
import type { BranchName } from "@/lib/crdt/branch-utils"
import {
  acquireLoroDoc,
  releaseLoroDoc,
  beginRemoteApply,
  endRemoteApply,
  setDocLastSavedBase64,
} from "@/lib/loro-doc-registry"
import { useCrdtSnapshotSync } from "@/lib/crdt/useCrdtSnapshotSync"
import { useFileNodeByPath } from "@/lib/hooks/use-file-node"
import { fileSystemNodeCollection } from "@/lib/collections"
import {
  createBranchDocKey,
  createBranchDocKeyById,
  getBranchSnapshot,
  getBranchesMetadata,
  initializeBranches,
  updateBranchSnapshot,
  setActiveBranch as setActiveBranchInMetadata,
  createBranch as createBranchInMetadata,
  listBranches,
  getActiveBranch,
  parseBranchDocKey,
  generateUniqueBranchName,
  sanitizeBranchName,
  renameBranch as renameBranchInMetadata,
  mergeBranches,
} from "@/lib/crdt/branch-utils"

type UseBranchDocReturn = {
  loroDoc: LoroDoc | null
  currentBranch: BranchName
  branches: BranchName[]
  isSyncing: boolean
  switchBranch: (branchName: BranchName) => void
  createBranch: (branchName: BranchName, fromBranch?: BranchName) => void
  createBranchAuto: (
    basePrefix?: string,
    fromBranch?: BranchName
  ) => BranchName | null
  renameBranch: (oldName: BranchName, newNameRaw: string) => void
  mergeBranch: (sourceBranch: BranchName) => Promise<void>
  flush: () => void
  markDirty: () => void
}

export function useBranchDoc(filePath: string): UseBranchDocReturn {
  const { node } = useFileNodeByPath(filePath)
  const [loroDoc, setLoroDoc] = useState<LoroDoc | null>(null)
  const docKeyRef = useRef<string | null>(null)
  const flushRef = useRef<(() => void) | null>(null)

  // Derive branch state from metadata as the single source of truth
  const currentBranch = useMemo(() => getActiveBranch(node), [node])
  const branches = useMemo(() => listBranches(node), [node])

  // Compute a stable doc key; fall back to path-based early
  const docKey = useMemo(() => {
    if (node?.id != null) return createBranchDocKeyById(node.id, currentBranch)
    return createBranchDocKey(filePath, currentBranch)
  }, [node?.id, currentBranch, filePath])

  // Debug helper to preview snapshot text
  const previewSnapshot = useCallback((base64: Base64String | null) => {
    try {
      if (!base64) return "<empty>"
      const d = new LoroDoc()
      d.import(base64ToBytes(base64))
      const t = d.getText("text").toString()
      return t.length > 80 ? `${t.slice(0, 80)}…` : t
    } catch {
      return "<decode-failed>"
    }
  }, [])

  // Manage Loro doc lifecycle when branch changes
  useEffect(() => {
    // Clean up previous doc (release only; flushing handled explicitly elsewhere)
    if (docKeyRef.current && docKeyRef.current !== docKey) {
      releaseLoroDoc(docKeyRef.current)
      docKeyRef.current = null
    }

    // Create new doc for current branch
    const newDoc = acquireLoroDoc(docKey)
    docKeyRef.current = docKey

    // Pre-import remote snapshot synchronously before editor mounts
    try {
      const { branchName: keyBranch } = parseBranchDocKey(docKey)
      const snapshot = getBranchSnapshot(node, keyBranch)
      if (snapshot !== undefined && snapshot !== null) {
        beginRemoteApply(docKey)
        const bytes = base64ToBytes(snapshot)
        newDoc.import(bytes)
        setDocLastSavedBase64(docKey, snapshot)
      }
    } catch (e) {
      console.warn("[BranchDoc] Pre-import failed", e)
    } finally {
      endRemoteApply(docKey)
    }

    setLoroDoc(newDoc)

    return () => {
      const cleanupKey = docKey
      if (cleanupKey) {
        releaseLoroDoc(cleanupKey)
      }
      setLoroDoc(null)
    }
  }, [docKey, filePath, currentBranch])

  // Get branch snapshot keyed to the current doc instance's key to avoid
  // exporting under the wrong branch during key transitions
  const effectiveKey = docKeyRef.current ?? docKey
  const effectiveBranch = useMemo(
    () => parseBranchDocKey(effectiveKey).branchName,
    [effectiveKey]
  )
  const branchSnapshot = getBranchSnapshot(node, effectiveBranch)

  // Debug wiring for sync

  // Handle snapshot sync with branch-aware saving
  const { isSyncing, flush, markDirty } = useCrdtSnapshotSync({
    loroDoc,
    fileKey: effectiveKey,
    remoteBase64: branchSnapshot,
    onExport: useCallback(
      (base64: Base64String) => {
        if (!node) return

        try {
          const keyAtExport = docKeyRef.current ?? effectiveKey
          const { branchName: branchForSave } = parseBranchDocKey(keyAtExport)
          fileSystemNodeCollection.update(node.id.toString(), (draft) => {
            // Initialize branches metadata if it doesn't exist
            if (!draft.metadata || !draft.metadata.branches) {
              const initialized = initializeBranches(base64)
              draft.metadata = {
                ...draft.metadata,
                ...initialized,
              }
            } else {
              const metadata = getBranchesMetadata(draft)
              const updated = updateBranchSnapshot(
                metadata,
                branchForSave,
                base64
              )
              draft.metadata = {
                ...draft.metadata,
                ...updated,
              }
            }

            draft.updatedAt = new Date()
          })
        } catch (error) {
          // If update fails, it might be because the node doesn't exist yet
          // This can happen with newly created files that haven't been persisted
          console.debug("[Branches] Could not save branch snapshot:", error)
        }
      },
      [node, effectiveKey, previewSnapshot]
    ),
  })

  // Store flush ref for cleanup (kept for symmetry; not used elsewhere)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  // Auto-mark dirty when doc changes
  // COMMENTED OUT: This might be causing a feedback loop
  // The editor's onUpdate already calls markDirty
  /*
  useEffect(() => {
    
    if (!loroDoc) return

    const handleChange = () => {
      
      markDirty()
    }

    const unsubscribe = loroDoc.subscribe(handleChange)
    return () => {
      
      unsubscribe()
    }
  }, [loroDoc, markDirty])
  */

  // Switch to a different branch
  const switchBranch = useCallback(
    (branchName: BranchName) => {
      if (!node || branchName === currentBranch) return

      // Flush current branch before switching
      flush()

      // Update metadata to track active branch
      try {
        fileSystemNodeCollection.update(node.id.toString(), (draft) => {
          const metadata = getBranchesMetadata(draft)
          const updated = setActiveBranchInMetadata(metadata, branchName)
          draft.metadata = {
            ...draft.metadata,
            ...updated,
          }
        })
      } catch (error) {
        console.debug("[Branches] Could not update active branch:", error)
      }
    },
    [node, currentBranch, flush]
  )

  // Create a new branch
  const createBranch = useCallback(
    (branchName: BranchName, fromBranch: BranchName = currentBranch) => {
      if (!node) return

      // Flush current doc first
      flush()

      // Get the source snapshot. Prefer in-memory export to avoid stale reads
      let sourceSnapshot: Base64String | null = null
      try {
        if (fromBranch === currentBranch && loroDoc) {
          const bytes = loroExportSnapshot(loroDoc)
          sourceSnapshot = bytesToBase64(bytes)
        } else {
          sourceSnapshot = getBranchSnapshot(node, fromBranch)
        }
      } catch (e) {
        console.debug(
          "[Branches] Could not export current doc for branch creation",
          e
        )
        sourceSnapshot = getBranchSnapshot(node, fromBranch)
      }

      try {
        fileSystemNodeCollection.update(node.id.toString(), (draft) => {
          const metadata = getBranchesMetadata(draft)

          // Create branch with the source snapshot
          const updated = createBranchInMetadata(
            metadata,
            branchName,
            fromBranch
          )

          // Ensure the new branch has the intended snapshot
          if (sourceSnapshot) {
            updated.branches[branchName].snapshot = sourceSnapshot
          }

          draft.metadata = {
            ...draft.metadata,
            ...updated,
          }
        })

        // Switch to new branch immediately
        switchBranch(branchName)
      } catch (error) {
        console.debug("[Branches] Could not create branch:", error)
      }
    },
    [node, currentBranch, flush, switchBranch, loroDoc]
  )

  // Create a new branch with an auto-generated unique name and switch to it
  const createBranchAuto = useCallback(
    (
      basePrefix: string = "branch",
      fromBranch: BranchName = currentBranch
    ): BranchName | null => {
      if (!node) return null
      // Flush current edits
      flush()

      // Compute source snapshot
      let sourceSnapshot: Base64String | null = null
      try {
        if (fromBranch === currentBranch && loroDoc) {
          const bytes = loroExportSnapshot(loroDoc)
          sourceSnapshot = bytesToBase64(bytes)
        } else {
          sourceSnapshot = getBranchSnapshot(node, fromBranch)
        }
      } catch {
        sourceSnapshot = getBranchSnapshot(node, fromBranch)
      }

      let newBranchName: BranchName = "" as BranchName
      try {
        fileSystemNodeCollection.update(node.id.toString(), (draft) => {
          const metadata = getBranchesMetadata(draft)
          const unique = generateUniqueBranchName(metadata, basePrefix)
          newBranchName = unique
          const updated = createBranchInMetadata(metadata, unique, fromBranch)
          if (sourceSnapshot) {
            updated.branches[unique].snapshot = sourceSnapshot
          }
          draft.metadata = {
            ...draft.metadata,
            ...updated,
          }
        })
        // Switch to the new branch
        if (newBranchName) {
          switchBranch(newBranchName)
        }
        return newBranchName || null
      } catch (error) {
        console.debug("[Branches] Could not create auto branch:", error)
        return null
      }
    },
    [node, currentBranch, flush, loroDoc, switchBranch]
  )

  // Rename an existing branch; if current is renamed, activeBranch is updated accordingly
  const renameBranchHandler = useCallback(
    (oldName: BranchName, newNameRaw: string) => {
      if (!node) return
      const desired = sanitizeBranchName(newNameRaw)
      if (!desired) return
      if (oldName === desired) return

      flush()
      try {
        fileSystemNodeCollection.update(node.id.toString(), (draft) => {
          const metadata = getBranchesMetadata(draft)
          if (!metadata) return

          // Ensure uniqueness: if desired exists, suffix with -1, -2, ...
          const existing = new Set(Object.keys(metadata.branches))
          let finalName = desired
          if (existing.has(finalName)) {
            let counter = 1
            while (existing.has(`${desired}-${counter}`)) counter += 1
            finalName = `${desired}-${counter}` as BranchName
          }

          const updated = renameBranchInMetadata(metadata, oldName, finalName)
          draft.metadata = {
            ...draft.metadata,
            ...updated,
          }
        })
      } catch (error) {
        console.debug("[Branches] Could not rename branch:", error)
      }
    },
    [node, flush]
  )

  // Merge current branch into the target branch
  const mergeBranchHandler = useCallback(
    async (targetBranch: BranchName) => {
      if (!node) return

      // Flush any pending changes before merging
      flush()

      try {
        // Get snapshots for both branches
        const currentSnapshot = getBranchSnapshot(node, currentBranch)
        const targetSnapshot = getBranchSnapshot(node, targetBranch)

        if (!currentSnapshot) {
          console.warn("[Branches] Current branch has no snapshot")
          return
        }

        // Merge current branch into target branch
        const mergedSnapshot = await mergeBranches(
          targetSnapshot || ("" as Base64String),
          currentSnapshot
        )

        // Update the target branch with merged snapshot
        fileSystemNodeCollection.update(node.id.toString(), (draft) => {
          const metadata = getBranchesMetadata(draft)
          const updated = updateBranchSnapshot(
            metadata,
            targetBranch,
            mergedSnapshot
          )
          draft.metadata = {
            ...draft.metadata,
            ...updated,
          }
          draft.updatedAt = new Date()
        })

        // Switch to the target branch after successful merge
        switchBranch(targetBranch)
      } catch (error) {
        console.error("[Branches] Merge failed:", error)
        throw error
      }
    },
    [node, currentBranch, flush, switchBranch]
  )

  return {
    loroDoc,
    currentBranch,
    branches,
    isSyncing,
    switchBranch,
    createBranch,
    createBranchAuto,
    renameBranch: renameBranchHandler,
    mergeBranch: mergeBranchHandler,
    flush,
    markDirty,
  }
}
