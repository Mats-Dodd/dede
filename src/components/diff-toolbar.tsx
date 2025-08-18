import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GitCompare, X } from "lucide-react"

interface DiffToolbarProps {
  sourceBranch: string
  targetBranch: string
  stats?: {
    additions: number
    deletions: number
    modifications: number
  }
  onExit: () => void
}

export function DiffToolbar({
  sourceBranch,
  targetBranch,
  stats,
  onExit,
}: DiffToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-yellow-50 border-b border-yellow-200">
      <div className="flex items-center gap-3">
        <GitCompare className="h-4 w-4 text-yellow-700" />
        <span className="text-sm font-medium text-yellow-900">
          Comparing: <span className="text-yellow-700">{sourceBranch}</span>
          {" → "}
          <span className="text-yellow-700">{targetBranch}</span>
        </span>

        {stats && (
          <div className="flex items-center gap-2 ml-2">
            {stats.additions > 0 && (
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200"
              >
                +{stats.additions} additions
              </Badge>
            )}
            {stats.deletions > 0 && (
              <Badge
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200"
              >
                -{stats.deletions} deletions
              </Badge>
            )}
            {stats.modifications > 0 && (
              <Badge
                variant="outline"
                className="bg-yellow-50 text-yellow-700 border-yellow-200"
              >
                ~{stats.modifications} modified
              </Badge>
            )}
          </div>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={onExit} className="gap-1">
        <X className="h-3 w-3" />
        Exit Diff View
      </Button>
    </div>
  )
}
