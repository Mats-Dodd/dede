import { useCallback, useEffect, useRef, useState } from "react"
import type { LoroDoc } from "loro-crdt"
import type { Base64String } from "@/types/crdt"
import { bytesToBase64, loroExportSnapshot } from "@/types/crdt"
import type { BranchName } from "@/lib/crdt/branch-utils"
import { acquireLoroDoc, releaseLoroDoc } from "@/lib/loro-doc-registry"
import { useCrdtSnapshotSync } from "@/lib/crdt/useCrdtSnapshotSync"
import { useFileNodeByPath } from "@/lib/hooks/use-file-node"
import { fileSystemNodeCollection } from "@/lib/collections"
import {
  createBranchDocKey,
  getBranchSnapshot,
  getBranchesMetadata,
  initializeBranches,
  updateBranchSnapshot,
  setActiveBranch as setActiveBranchInMetadata,
  createBranch as createBranchInMetadata,
  DEFAULT_BRANCH,
  listBranches,
  parseBranchDocKey,
} from "@/lib/crdt/branch-utils"

type UseBranchDocReturn = {
  loroDoc: LoroDoc | null
  currentBranch: BranchName
  branches: BranchName[]
  isSyncing: boolean
  switchBranch: (branchName: BranchName) => void
  createBranch: (branchName: BranchName, fromBranch?: BranchName) => void
  flush: () => void
  markDirty: () => void
}

export function useBranchDoc(filePath: string): UseBranchDocReturn {
  const { node } = useFileNodeByPath(filePath)
  const [currentBranch, setCurrentBranch] = useState<BranchName>(DEFAULT_BRANCH)
  const [branches, setBranches] = useState<BranchName[]>([DEFAULT_BRANCH])
  const [loroDoc, setLoroDoc] = useState<LoroDoc | null>(null)
  const docKeyRef = useRef<string | null>(null)
  const flushRef = useRef<(() => void) | null>(null)
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null)

  // Initialize branches metadata if needed (no legacy contentCRDT fallback)
  useEffect(() => {
    if (!node) return
    const metadata = getBranchesMetadata(node)

    // Initialize branches if this is a legacy file
    if (!metadata) {
      // For new files, just set default state without updating yet
      // The first save will initialize the metadata
      setCurrentBranch(DEFAULT_BRANCH)
      setBranches([DEFAULT_BRANCH])

      // Optionally initialize metadata with an empty snapshot for main branch
      const nodeAge = node.createdAt
        ? Date.now() - new Date(node.createdAt).getTime()
        : 0
      if (nodeAge > 1000) {
        try {
          fileSystemNodeCollection.update(node.id.toString(), (draft) => {
            if (!draft.metadata || !draft.metadata.branches) {
              const initialized = initializeBranches("" as Base64String)
              draft.metadata = {
                ...draft.metadata,
                ...initialized,
              }
            }
          })
        } catch (error) {
          // Node might not be ready yet, will retry on next render
          console.debug("[Branches] Could not initialize branches yet:", error)
        }
      }
    } else {
      const activeBranch = metadata.activeBranch || DEFAULT_BRANCH
      setCurrentBranch(activeBranch)
      setBranches(listBranches(node))
    }
  }, [node])

  // Manage Loro doc lifecycle when branch changes
  useEffect(() => {
    console.log("[BranchDoc] Doc lifecycle effect triggered", {
      filePath,
      currentBranch,
    })

    // Clean up previous doc (release only; flushing handled explicitly elsewhere)
    if (docKeyRef.current) {
      console.log("[BranchDoc] Cleaning up previous doc:", docKeyRef.current)
      // Release the old doc
      releaseLoroDoc(docKeyRef.current)
      docKeyRef.current = null
    }

    // Create new doc for current branch
    const newDocKey = createBranchDocKey(filePath, currentBranch)
    console.log("[BranchDoc] Creating new doc:", newDocKey)
    const newDoc = acquireLoroDoc(newDocKey)
    docKeyRef.current = newDocKey
    setActiveDocKey(newDocKey)
    setLoroDoc(newDoc)

    return () => {
      const cleanupKey = newDocKey
      console.log("[BranchDoc] Cleanup function called for:", cleanupKey)
      if (cleanupKey) {
        releaseLoroDoc(cleanupKey)
      }
      setLoroDoc(null)
    }
  }, [filePath, currentBranch]) // Removed node from dependencies - we don't want to recreate when metadata changes

  // Get branch snapshot
  const effectiveKey =
    activeDocKey ?? createBranchDocKey(filePath, currentBranch)
  const effectiveBranch = parseBranchDocKey(effectiveKey).branchName
  const branchSnapshot = getBranchSnapshot(node, effectiveBranch)

  // Debug wiring for sync
  console.log("[BranchDoc] Sync wiring", {
    hasDoc: !!loroDoc,
    activeDocKey,
    effectiveKey,
    effectiveBranch,
    remotePresent: !!branchSnapshot,
    currentBranch,
  })

  // Handle snapshot sync with branch-aware saving
  const { isSyncing, flush, markDirty } = useCrdtSnapshotSync({
    loroDoc,
    fileKey: effectiveKey,
    remoteBase64: branchSnapshot,
    onExport: useCallback(
      (base64: Base64String) => {
        if (!node || !effectiveKey) return
        const { branchName } = parseBranchDocKey(effectiveKey)

        try {
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
              const updated = updateBranchSnapshot(metadata, branchName, base64)
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
      [node, effectiveKey]
    ),
  })

  // Store flush ref for cleanup
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

      // Update local state (will trigger doc recreation)
      setCurrentBranch(branchName)
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

          // Make sure the new branch has the right snapshot
          if (sourceSnapshot) {
            updated.branches[branchName].snapshot = sourceSnapshot
          }

          draft.metadata = {
            ...draft.metadata,
            ...updated,
          }
        })

        // Update branches list
        setBranches((prev) => {
          if (!prev.includes(branchName)) {
            return [...prev, branchName]
          }
          return prev
        })

        // Switch to new branch
        setTimeout(() => {
          switchBranch(branchName)
        }, 100)
      } catch (error) {
        console.debug("[Branches] Could not create branch:", error)
        // Still update local state to allow working with the branch
        setBranches((prev) => {
          if (!prev.includes(branchName)) {
            return [...prev, branchName]
          }
          return prev
        })
      }
    },
    [node, currentBranch, flush, switchBranch, loroDoc]
  )

  return {
    loroDoc,
    currentBranch,
    branches,
    isSyncing,
    switchBranch,
    createBranch,
    flush,
    markDirty,
  }
}
