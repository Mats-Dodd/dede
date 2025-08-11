import type { Base64String } from "@/types/crdt"
import type { FileSystemNode } from "@/db/schema"
import { bytesToBase64, base64ToBytes, loroExportSnapshot } from "@/types/crdt"
import { LoroDoc } from "loro-crdt"

// Branch-related types
export type BranchName = string
export type BranchData = {
  snapshot: Base64String
  createdAt: string
  updatedAt: string
}

export type BranchesMetadata = {
  branches: Record<BranchName, BranchData>
  activeBranch?: BranchName
  recentSnapshots?: Array<{
    snapshot: Base64String
    timestamp: string
    branchName: BranchName
  }>
}

// Default branch name
export const DEFAULT_BRANCH = "main"
export const FEATURE_BRANCH = "feature"

// Helper to get branches metadata from node
export function getBranchesMetadata(
  node: FileSystemNode | null | undefined
): BranchesMetadata | null {
  if (!node?.metadata) return null
  const metadata = node.metadata as Record<string, unknown>
  if (!metadata.branches) return null
  return metadata as unknown as BranchesMetadata
}

// Initialize branches for a file that doesn't have them yet
export function initializeBranches(
  currentSnapshot: Base64String | null
): BranchesMetadata {
  const now = new Date().toISOString()
  return {
    branches: {
      [DEFAULT_BRANCH]: {
        snapshot: (currentSnapshot ?? ("" as Base64String)) as Base64String,
        createdAt: now,
        updatedAt: now,
      },
    },
    activeBranch: DEFAULT_BRANCH,
  }
}

// Get the snapshot for a specific branch
export function getBranchSnapshot(
  node: FileSystemNode | null | undefined,
  branchName: BranchName
): Base64String | null {
  const metadata = getBranchesMetadata(node)
  if (!metadata) return null
  return metadata.branches[branchName]?.snapshot || null
}

// Create a doc key for branch-specific loro docs
export function createBranchDocKey(
  filePath: string,
  branchName: BranchName
): string {
  return `${filePath}::${branchName}`
}

// Parse a branch doc key back to components
export function parseBranchDocKey(docKey: string): {
  filePath: string
  branchName: BranchName
} {
  const lastDoubleColon = docKey.lastIndexOf("::")
  if (lastDoubleColon === -1) {
    return { filePath: docKey, branchName: DEFAULT_BRANCH }
  }
  return {
    filePath: docKey.substring(0, lastDoubleColon),
    branchName: docKey.substring(lastDoubleColon + 2),
  }
}

// List all branches for a file
export function listBranches(
  node: FileSystemNode | null | undefined
): BranchName[] {
  const metadata = getBranchesMetadata(node)
  if (!metadata) return [DEFAULT_BRANCH]
  return Object.keys(metadata.branches)
}

// Get active branch for a file
export function getActiveBranch(
  node: FileSystemNode | null | undefined
): BranchName {
  const metadata = getBranchesMetadata(node)
  return metadata?.activeBranch || DEFAULT_BRANCH
}

// Create a new branch by copying from source
export function createBranch(
  metadata: BranchesMetadata | null,
  newBranchName: BranchName,
  sourceBranchName: BranchName = DEFAULT_BRANCH
): BranchesMetadata {
  const now = new Date().toISOString()

  // If no metadata, initialize with main branch first
  if (!metadata) {
    metadata = initializeBranches("" as Base64String)
  }

  const sourceSnapshot =
    metadata.branches[sourceBranchName]?.snapshot || ("" as Base64String)

  return {
    ...metadata,
    branches: {
      ...metadata.branches,
      [newBranchName]: {
        snapshot: sourceSnapshot,
        createdAt: now,
        updatedAt: now,
      },
    },
  }
}

// Update branch snapshot
export function updateBranchSnapshot(
  metadata: BranchesMetadata | null,
  branchName: BranchName,
  snapshot: Base64String
): BranchesMetadata {
  const now = new Date().toISOString()

  if (!metadata) {
    metadata = initializeBranches(snapshot)
  }

  return {
    ...metadata,
    branches: {
      ...metadata.branches,
      [branchName]: {
        ...metadata.branches[branchName],
        snapshot,
        updatedAt: now,
      },
    },
  }
}

// Set active branch
export function setActiveBranch(
  metadata: BranchesMetadata | null,
  branchName: BranchName
): BranchesMetadata {
  if (!metadata) {
    metadata = initializeBranches("" as Base64String)
  }

  return {
    ...metadata,
    activeBranch: branchName,
  }
}

// Delete a branch (cannot delete main)
export function deleteBranch(
  metadata: BranchesMetadata | null,
  branchName: BranchName
): BranchesMetadata | null {
  if (!metadata || branchName === DEFAULT_BRANCH) return metadata

  const { [branchName]: _, ...remainingBranches } = metadata.branches

  return {
    ...metadata,
    branches: remainingBranches,
    activeBranch:
      metadata.activeBranch === branchName
        ? DEFAULT_BRANCH
        : metadata.activeBranch,
  }
}

// Simple diff between two branches (returns text comparison)
export async function diffBranches(
  snapshot1: Base64String,
  snapshot2: Base64String
): Promise<{ branch1Text: string; branch2Text: string }> {
  const doc1 = new LoroDoc()
  const doc2 = new LoroDoc()

  if (snapshot1) {
    doc1.import(base64ToBytes(snapshot1))
  }
  if (snapshot2) {
    doc2.import(base64ToBytes(snapshot2))
  }

  // Get text content from both docs
  const text1 = doc1.getText("text")
  const text2 = doc2.getText("text")

  return {
    branch1Text: text1.toString(),
    branch2Text: text2.toString(),
  }
}

// Merge branch into another (simple import)
export async function mergeBranches(
  targetSnapshot: Base64String,
  sourceSnapshot: Base64String
): Promise<Base64String> {
  const targetDoc = new LoroDoc()

  // Import target first, then source (source wins in conflicts)
  if (targetSnapshot) {
    targetDoc.import(base64ToBytes(targetSnapshot))
  }
  if (sourceSnapshot) {
    targetDoc.import(base64ToBytes(sourceSnapshot))
  }

  // Export merged result
  return bytesToBase64(loroExportSnapshot(targetDoc))
}

// Add recent snapshot for retro-branching (future feature)
export function addRecentSnapshot(
  metadata: BranchesMetadata | null,
  branchName: BranchName,
  snapshot: Base64String,
  maxSnapshots: number = 20
): BranchesMetadata {
  if (!metadata) {
    metadata = initializeBranches(snapshot)
  }

  const recentSnapshots = metadata.recentSnapshots || []
  const newSnapshot = {
    snapshot,
    timestamp: new Date().toISOString(),
    branchName,
  }

  // Add new snapshot and cap array size
  const updated = [newSnapshot, ...recentSnapshots].slice(0, maxSnapshots)

  return {
    ...metadata,
    recentSnapshots: updated,
  }
}
