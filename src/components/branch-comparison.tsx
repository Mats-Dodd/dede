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
import { base64ToBytes } from "@/types/crdt"
import {
  getBranchSnapshot,
  listBranches,
  type BranchName,
} from "@/lib/crdt/branch-utils"
import { useFileNodeByPath } from "@/lib/hooks/use-file-node"

interface BranchComparisonProps {
  filePath: string
}

export function BranchComparison({ filePath }: BranchComparisonProps) {
  const { node } = useFileNodeByPath(filePath)
  const [leftBranch, setLeftBranch] = useState<BranchName>("")
  const [rightBranch, setRightBranch] = useState<BranchName>("")
  const [leftJson, setLeftJson] = useState<string>("")
  const [rightJson, setRightJson] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const branches = listBranches(node)

  const loadBranchSnapshot = async (
    branchName: BranchName
  ): Promise<string> => {
    try {
      const snapshot = getBranchSnapshot(node, branchName)
      if (!snapshot) {
        return JSON.stringify(
          { error: "No snapshot found for branch" },
          null,
          2
        )
      }

      const doc = new LoroDoc()
      const bytes = base64ToBytes(snapshot)
      doc.import(bytes)

      return JSON.stringify(doc.toJSON(), null, 2)
    } catch (error) {
      console.error("Failed to load branch snapshot:", error)
      return JSON.stringify(
        { error: "Failed to load snapshot", details: error },
        null,
        2
      )
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

      setLeftJson(leftData)
      setRightJson(rightData)
    } catch (error) {
      console.error("Comparison failed:", error)
    } finally {
      setIsLoading(false)
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
      )}
    </div>
  )
}
