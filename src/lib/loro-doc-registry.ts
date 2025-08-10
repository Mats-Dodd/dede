import { useEffect, useState } from "react"
import { LoroDoc } from "loro-crdt"
import type { Base64String } from "@/types/crdt"

type RegistryEntry = {
  doc: LoroDoc
  refCount: number
  lastSavedBase64: Base64String | null
  isApplyingRemote: boolean
}

const loroRegistry = new Map<string, RegistryEntry>()

export function acquireLoroDoc(key: string): LoroDoc {
  let entry = loroRegistry.get(key)
  if (!entry) {
    const doc = new LoroDoc()
    entry = {
      doc,
      refCount: 0,
      lastSavedBase64: null,
      isApplyingRemote: false,
    }
    loroRegistry.set(key, entry)
  }
  entry.refCount += 1
  return entry.doc
}

export function releaseLoroDoc(key: string) {
  const entry = loroRegistry.get(key)
  if (!entry) return
  entry.refCount -= 1
  if (entry.refCount <= 0) {
    loroRegistry.delete(key)
  }
}

export function useSharedLoroDoc(
  key: string | null | undefined
): LoroDoc | null {
  const [doc, setDoc] = useState<LoroDoc | null>(null)

  useEffect(() => {
    if (!key) return
    const d = acquireLoroDoc(key)
    setDoc(d)
    return () => {
      releaseLoroDoc(key)
      setDoc(null)
    }
  }, [key])

  return doc
}

export function setDocLastSavedBase64(key: string, value: Base64String) {
  const entry = loroRegistry.get(key)
  if (entry) entry.lastSavedBase64 = value
}

export function getDocLastSavedBase64(key: string): Base64String | null {
  return loroRegistry.get(key)?.lastSavedBase64 ?? null
}

export function beginRemoteApply(key: string) {
  const entry = loroRegistry.get(key)
  if (entry) entry.isApplyingRemote = true
}

export function endRemoteApply(key: string) {
  const entry = loroRegistry.get(key)
  if (entry) entry.isApplyingRemote = false
}

export function isRemoteApplying(key: string): boolean {
  return loroRegistry.get(key)?.isApplyingRemote ?? false
}
