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
    console.log("[BranchDoc] Doc lifecycle effect triggered", {
      filePath,
      currentBranch,
      docKey,
    })

    // Clean up previous doc (release only; flushing handled explicitly elsewhere)
    if (docKeyRef.current && docKeyRef.current !== docKey) {
      console.log("[BranchDoc] Cleaning up previous doc:", docKeyRef.current)
      releaseLoroDoc(docKeyRef.current)
      docKeyRef.current = null
    }

    // Create new doc for current branch
    console.log("[BranchDoc] Creating new doc:", docKey)
    const newDoc = acquireLoroDoc(docKey)
    docKeyRef.current = docKey

    // Pre-import remote snapshot synchronously before editor mounts
    try {
      const { branchName: keyBranch } = parseBranchDocKey(docKey)
      const snapshot = getBranchSnapshot(node, keyBranch)
      if (snapshot !== undefined && snapshot !== null) {
        console.log("[BranchDoc] Pre-importing branch snapshot before mount", {
          hasSnapshot: !!snapshot,
          docKey,
          branch: keyBranch,
          preview: previewSnapshot(snapshot),
        })
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
      console.log("[BranchDoc] Cleanup function called for:", cleanupKey)
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
  console.log("[BranchDoc] Sync wiring", {
    hasDoc: !!loroDoc,
    effectiveKey,
    effectiveBranch,
    remotePresent: !!branchSnapshot,
    currentBranch,
    remotePreview: previewSnapshot(branchSnapshot || null),
  })

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
          console.log("[BranchDoc] Saved snapshot", {
            key: keyAtExport,
            branch: branchForSave,
            preview: previewSnapshot(base64),
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
    console.log("[BranchDoc] Setting up doc change subscription")
    if (!loroDoc) return

    const handleChange = () => {
      console.log("[BranchDoc] Doc changed, marking dirty")
      markDirty()
    }

    const unsubscribe = loroDoc.subscribe(handleChange)
    return () => {
      console.log("[BranchDoc] Unsubscribing from doc changes")
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

  // Merge another branch into the current branch
  const mergeBranchHandler = useCallback(
    async (sourceBranch: BranchName) => {
      if (!node) return

      // Flush any pending changes before merging
      flush()

      try {
        // Get snapshots for both branches
        const sourceSnapshot = getBranchSnapshot(node, sourceBranch)
        const targetSnapshot = getBranchSnapshot(node, currentBranch)

        if (!sourceSnapshot) {
          console.warn("[Branches] Source branch has no snapshot")
          return
        }

        // Merge using Loro's built-in CRDT merge
        const mergedSnapshot = await mergeBranches(
          targetSnapshot || ("" as Base64String),
          sourceSnapshot
        )

        // Update the current branch with merged snapshot
        fileSystemNodeCollection.update(node.id.toString(), (draft) => {
          const metadata = getBranchesMetadata(draft)
          const updated = updateBranchSnapshot(
            metadata,
            currentBranch,
            mergedSnapshot
          )
          draft.metadata = {
            ...draft.metadata,
            ...updated,
          }
          draft.updatedAt = new Date()
        })

        console.log("[Branches] Merged", sourceBranch, "into", currentBranch)
      } catch (error) {
        console.error("[Branches] Merge failed:", error)
      }
    },
    [node, currentBranch, flush]
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
