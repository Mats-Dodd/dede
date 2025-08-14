import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LoroDoc } from "loro-crdt"
import type { Base64String } from "@/types/crdt"
import {
  beginRemoteApply,
  endRemoteApply,
  getDocLastSavedBase64,
  isRemoteApplying,
  setDocLastSavedBase64,
} from "@/lib/loro-doc-registry"
import { base64ToBytes, bytesToBase64, loroExportSnapshot } from "@/types/crdt"

type UseCrdtSnapshotSyncArgs = {
  loroDoc: LoroDoc | null | undefined
  fileKey: string
  remoteBase64: Base64String | null | undefined
  onExport: (base64: Base64String) => void
}

type UseCrdtSnapshotSyncReturn = {
  isSyncing: boolean
  lastExportedBase64: Base64String | null
  markDirty: () => void
  flush: () => void
}

export function useCrdtSnapshotSync({
  loroDoc,
  fileKey,
  remoteBase64,
  onExport,
}: UseCrdtSnapshotSyncArgs): UseCrdtSnapshotSyncReturn {
  const [isSyncing, setIsSyncing] = useState(false)
  const lastSavedRef = useRef<Base64String | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const skipNextExportRef = useRef(false)

  // Keep lastSavedRef in sync with registry on mount
  useEffect(() => {
    lastSavedRef.current = getDocLastSavedBase64(fileKey)
  }, [fileKey])

  // Import remote snapshot into the loroDoc when it changes
  useEffect(() => {
    if (!loroDoc || remoteBase64 === undefined || remoteBase64 === null) return
    if (remoteBase64 === lastSavedRef.current) return
    try {
      const bytes = base64ToBytes(remoteBase64)
      beginRemoteApply(fileKey)
      loroDoc.import(bytes)
      endRemoteApply(fileKey)
      lastSavedRef.current = remoteBase64
      setDocLastSavedBase64(fileKey, remoteBase64)
      // Avoid exporting immediately after an import
      skipNextExportRef.current = true
    } catch (e) {
      console.warn("[Loro] Import failed", e)
    }
  }, [fileKey, loroDoc, remoteBase64])

  const runWhenIdle = useMemo(() => {
    const ric = (
      typeof window !== "undefined" ? window.requestIdleCallback : undefined
    ) as undefined | ((cb: () => void, opts?: { timeout?: number }) => number)
    return (fn: () => void) => {
      if (ric) {
        ric(fn, { timeout: 500 })
      } else {
        setTimeout(fn, 0)
      }
    }
  }, [])

  const doExport = useCallback(() => {
    if (!loroDoc) return
    if (isRemoteApplying(fileKey)) return
    if (skipNextExportRef.current) {
      skipNextExportRef.current = false
      return
    }
    try {
      setIsSyncing(true)
      const snapBytes = loroExportSnapshot(loroDoc)
      const snapBase64 = bytesToBase64(snapBytes)
      const lastSaved = lastSavedRef.current ?? getDocLastSavedBase64(fileKey)
      if (snapBase64 !== lastSaved) {
        onExport(snapBase64)
        lastSavedRef.current = snapBase64
        setDocLastSavedBase64(fileKey, snapBase64)
      }
    } catch (e) {
      console.warn("[Loro] Snapshot export failed", e)
    } finally {
      setIsSyncing(false)
    }
  }, [fileKey, loroDoc, onExport])

  const markDirty = useCallback(() => {
    if (!loroDoc) return
    if (isRemoteApplying(fileKey)) return
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    // Debounce a bit, then run on idle
    timeoutRef.current = window.setTimeout(() => {
      runWhenIdle(doExport)
    }, 300)
  }, [doExport, fileKey, loroDoc, runWhenIdle])

  const flush = useCallback(() => {
    if (!loroDoc) return
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    doExport()
  }, [doExport, loroDoc])

  // Flush on unload and on unmount
  useEffect(() => {
    const handleBeforeUnload = () => flush()
    const handlePageHide = () => flush()
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload)
      window.addEventListener("pagehide", handlePageHide)
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", handleBeforeUnload)
        window.removeEventListener("pagehide", handlePageHide)
      }
      flush()
    }
  }, [flush])

  return {
    isSyncing,
    lastExportedBase64: lastSavedRef.current ?? null,
    markDirty,
    flush,
  }
}
