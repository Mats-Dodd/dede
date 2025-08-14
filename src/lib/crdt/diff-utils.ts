import DiffMatchPatch from "diff-match-patch"

interface DocumentNode {
  children?: string[]
}

interface DocumentStructure {
  doc?: {
    children?: DocumentNode[]
  }
}

export function extractTextFromDoc(docJson: unknown): string {
  const typedDoc = docJson as DocumentStructure
  if (!typedDoc?.doc?.children) return ""

  const paragraphs = typedDoc.doc.children
  return paragraphs
    .map((paragraph: DocumentNode) => {
      if (!paragraph.children) return ""
      return paragraph.children.join("")
    })
    .filter((text: string) => text.trim() !== "")
    .join("\n\n")
}

export function computeDocumentDiff(text1: string, text2: string) {
  const dmp = new DiffMatchPatch()
  const diffs = dmp.diff_main(text1, text2)
  dmp.diff_cleanupSemantic(diffs)
  return diffs
}

export interface DiffChunk {
  type: "equal" | "delete" | "insert"
  content: string
}

export function formatDiffForDisplay(
  diffs: Array<[number, string]>
): DiffChunk[] {
  return diffs.map(([operation, text]) => {
    switch (operation) {
      case DiffMatchPatch.DIFF_DELETE:
        return { type: "delete", content: text }
      case DiffMatchPatch.DIFF_INSERT:
        return { type: "insert", content: text }
      case DiffMatchPatch.DIFF_EQUAL:
      default:
        return { type: "equal", content: text }
    }
  })
}

export function getDiffStats(diffs: Array<[number, string]>) {
  let additions = 0
  let deletions = 0

  diffs.forEach(([operation, text]) => {
    if (operation === DiffMatchPatch.DIFF_INSERT) {
      additions += text.length
    } else if (operation === DiffMatchPatch.DIFF_DELETE) {
      deletions += text.length
    }
  })

  return { additions, deletions }
}
