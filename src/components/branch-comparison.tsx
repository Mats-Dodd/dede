import { useState } from "react"
import { LoroDoc } from "loro-crdt"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { base64ToBytes } from "@/types/crdt"
import {
  getBranchSnapshot,
  listBranches,
  type BranchName,
} from "@/lib/crdt/branch-utils"
import { useFileNodeByPath } from "@/lib/hooks/use-file-node"
import {
  extractTextFromDoc,
  computeDocumentDiff,
  formatDiffForDisplay,
  getDiffStats,
  type DiffChunk,
} from "@/lib/crdt/diff-utils"

interface BranchComparisonProps {
  filePath: string
}

export function BranchComparison({ filePath }: BranchComparisonProps) {
  const { node } = useFileNodeByPath(filePath)
  const [leftBranch, setLeftBranch] = useState<BranchName>("")
  const [rightBranch, setRightBranch] = useState<BranchName>("")
  const [leftJson, setLeftJson] = useState<string>("")
  const [rightJson, setRightJson] = useState<string>("")
  const [diffChunks, setDiffChunks] = useState<DiffChunk[]>([])
  const [diffStats, setDiffStats] = useState({ additions: 0, deletions: 0 })
  const [isLoading, setIsLoading] = useState(false)

  const branches = listBranches(node)

  const loadBranchSnapshot = async (
    branchName: BranchName
  ): Promise<{ json: string; docJson: unknown }> => {
    try {
      const snapshot = getBranchSnapshot(node, branchName)
      if (!snapshot) {
        const errorResult = { error: "No snapshot found for branch" }
        return {
          json: JSON.stringify(errorResult, null, 2),
          docJson: errorResult,
        }
      }

      const doc = new LoroDoc()
      const bytes = base64ToBytes(snapshot)
      doc.import(bytes)
      const docJson = doc.toJSON()

      return {
        json: JSON.stringify(docJson, null, 2),
        docJson,
      }
    } catch (error) {
      console.error("Failed to load branch snapshot:", error)
      const errorResult = { error: "Failed to load snapshot", details: error }
      return {
        json: JSON.stringify(errorResult, null, 2),
        docJson: errorResult,
      }
    }
  }

  const handleCompare = async () => {
    if (!leftBranch || !rightBranch) return

    setIsLoading(true)
    try {
      const [leftData, rightData] = await Promise.all([
        loadBranchSnapshot(leftBranch),
        loadBranchSnapshot(rightBranch),
      ])

      setLeftJson(leftData.json)
      setRightJson(rightData.json)

      // Compute diff
      const leftText = extractTextFromDoc(leftData.docJson)
      const rightText = extractTextFromDoc(rightData.docJson)
      const diffs = computeDocumentDiff(leftText, rightText)
      const chunks = formatDiffForDisplay(diffs)
      const stats = getDiffStats(diffs)

      setDiffChunks(chunks)
      setDiffStats(stats)
    } catch (error) {
      console.error("Comparison failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const renderDiffChunk = (chunk: DiffChunk, index: number) => {
    const baseClasses = "font-mono text-sm whitespace-pre-wrap"

    switch (chunk.type) {
      case "insert":
        return (
          <span
            key={index}
            className={`${baseClasses} bg-green-100 text-green-800`}
          >
            {chunk.content}
          </span>
        )
      case "delete":
        return (
          <span
            key={index}
            className={`${baseClasses} bg-red-100 text-red-800 line-through`}
          >
            {chunk.content}
          </span>
        )
      case "equal":
      default:
        return (
          <span key={index} className={baseClasses}>
            {chunk.content}
          </span>
        )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <label className="text-sm font-medium">Left Branch</label>
          <Select value={leftBranch} onValueChange={setLeftBranch}>
            <SelectTrigger>
              <SelectValue placeholder="Select left branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch} value={branch}>
                  {branch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium">Right Branch</label>
          <Select value={rightBranch} onValueChange={setRightBranch}>
            <SelectTrigger>
              <SelectValue placeholder="Select right branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch} value={branch}>
                  {branch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleCompare}
          disabled={!leftBranch || !rightBranch || isLoading}
          className="mt-6"
        >
          {isLoading ? "Loading..." : "Compare"}
        </Button>
      </div>

      {(leftJson || rightJson) && (
        <Tabs defaultValue="diff" className="w-full">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="diff">Diff</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            {diffStats.additions > 0 || diffStats.deletions > 0 ? (
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  +{diffStats.additions}
                </Badge>
                <Badge variant="outline" className="bg-red-50 text-red-700">
                  -{diffStats.deletions}
                </Badge>
              </div>
            ) : null}
          </div>

          <TabsContent value="diff">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {leftBranch} → {rightBranch}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-1">
                    {diffChunks.map((chunk, index) =>
                      renderDiffChunk(chunk, index)
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="json">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {leftBranch} - JSON Output
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <pre className="text-xs">{leftJson}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {rightBranch} - JSON Output
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <pre className="text-xs">{rightJson}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
