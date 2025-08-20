import DiffMatchPatch from "diff-match-patch"
import type { JSONContent } from "@tiptap/core"

export type DiffType = "added" | "deleted" | "modified" | "unchanged"

export interface TextDiff {
  start: number
  end: number
  type: "insert" | "delete"
  content: string
}

export interface DiffNode {
  type: DiffType
  node: JSONContent
  textDiffs?: TextDiff[]
}

export interface DiffResult {
  nodes: DiffNode[]
  stats: {
    additions: number
    deletions: number
    modifications: number
  }
}

/**
 * Compare two ProseMirror/Tiptap JSON documents and return diff information
 */
export function diffProseMirrorDocs(
  leftDoc: JSONContent,
  rightDoc: JSONContent
): DiffResult {
  const result: DiffResult = {
    nodes: [],
    stats: {
      additions: 0,
      deletions: 0,
      modifications: 0,
    },
  }

  const leftNodes = leftDoc.content || []
  const rightNodes = rightDoc.content || []

  // Process nodes with a simple alignment algorithm
  let leftIndex = 0
  let rightIndex = 0

  while (leftIndex < leftNodes.length || rightIndex < rightNodes.length) {
    const leftNode = leftNodes[leftIndex]
    const rightNode = rightNodes[rightIndex]

    if (!leftNode && rightNode) {
      // Node was added
      result.nodes.push({
        type: "added",
        node: rightNode,
      })
      result.stats.additions++
      rightIndex++
    } else if (leftNode && !rightNode) {
      // Node was deleted
      result.nodes.push({
        type: "deleted",
        node: leftNode,
      })
      result.stats.deletions++
      leftIndex++
    } else if (leftNode && rightNode) {
      // Compare nodes
      const comparison = compareNodes(leftNode, rightNode)
      result.nodes.push(comparison)

      if (comparison.type === "modified") {
        result.stats.modifications++
      }

      leftIndex++
      rightIndex++
    }
  }

  return result
}

/**
 * Compare two individual nodes and determine their diff status
 */
function compareNodes(leftNode: JSONContent, rightNode: JSONContent): DiffNode {
  // Check if node types are different
  if (leftNode.type !== rightNode.type) {
    // Treat as deletion + addition
    return {
      type: "modified",
      node: rightNode,
      textDiffs: [],
    }
  }

  // Extract text content from nodes
  const leftText = extractTextFromNode(leftNode)
  const rightText = extractTextFromNode(rightNode)

  // If text is identical, nodes are unchanged
  if (leftText === rightText) {
    return {
      type: "unchanged",
      node: rightNode,
    }
  }

  // Diff the text content
  const textDiffs = diffTextContent(leftText, rightText)

  return {
    type: "modified",
    node: rightNode,
    textDiffs,
  }
}

/**
 * Extract plain text from a ProseMirror node
 */
function extractTextFromNode(node: JSONContent): string {
  if (node.type === "text") {
    return node.text || ""
  }

  if (!node.content) {
    return ""
  }

  return node.content
    .map((child) => {
      if (child.type === "text") {
        return child.text || ""
      }
      return extractTextFromNode(child)
    })
    .join("")
}

/**
 * Diff text content and return detailed change information
 */
function diffTextContent(leftText: string, rightText: string): TextDiff[] {
  const dmp = new DiffMatchPatch()
  const diffs = dmp.diff_main(leftText, rightText)
  dmp.diff_cleanupSemantic(diffs)

  const textDiffs: TextDiff[] = []
  let leftPos = 0 // Position in the left (original) text
  let rightPos = 0 // Position in the right (new) text

  for (const [operation, text] of diffs) {
    if (operation === DiffMatchPatch.DIFF_INSERT) {
      // Text that exists in right but not in left (additions)
      textDiffs.push({
        start: rightPos,
        end: rightPos + text.length,
        type: "insert",
        content: text,
      })
      rightPos += text.length
    } else if (operation === DiffMatchPatch.DIFF_DELETE) {
      // Text that exists in left but not in right (deletions)
      textDiffs.push({
        start: leftPos,
        end: leftPos + text.length,
        type: "delete",
        content: text,
      })
      leftPos += text.length
    } else {
      // Equal text - advance both positions
      leftPos += text.length
      rightPos += text.length
    }
  }

  return textDiffs
}
