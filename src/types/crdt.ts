// Centralized CRDT-related types and helpers
// These are intentionally lightweight and browser-friendly.

import type { LoroDoc } from "loro-crdt"

// Branded base64 string type to avoid accidental misuse
export type Base64String = string & { readonly __brand: "Base64String" }

// We do not depend on a concrete version shape; treat as opaque
export type LoroVersion = unknown

export function bytesToBase64(bytes: Uint8Array): Base64String {
  if (bytes.length === 0) return "" as Base64String
  let binary = ""
  const chunkSize = 0x8000 // 32k chunks to avoid call stack limits
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary) as Base64String
}

export function base64ToBytes(b64: Base64String): Uint8Array {
  if (!b64) return new Uint8Array()
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Local, typed wrappers around Loro export flows to avoid leaking any
type LoroDocWithExport = LoroDoc & {
  export: (
    opts: { mode: "snapshot" } | { mode: "update"; from?: LoroVersion }
  ) => Uint8Array
  version: () => LoroVersion
}

export function loroExportSnapshot(doc: LoroDoc): Uint8Array {
  const d = doc as unknown as LoroDocWithExport
  return d.export({ mode: "snapshot" })
}

export function loroExportUpdate(doc: LoroDoc, from?: LoroVersion): Uint8Array {
  const d = doc as unknown as LoroDocWithExport
  if (from !== undefined) {
    return d.export({ mode: "update", from })
  }
  return d.export({ mode: "update" })
}
