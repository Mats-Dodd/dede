import { useFileNodeByPath } from "@/lib/hooks/use-file-node"
import { TabsContent } from "@/components/ui/tabs"
import Tiptap from "@/components/editor"
import { useBranchDoc } from "@/lib/hooks/use-branch-doc"
import { Button } from "@/components/ui/button"
import { GitBranch, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"

export default function FileEditorPane({
  filePath,
}: {
  filePath: string
  key?: string
}) {
  const { node, setTitle } = useFileNodeByPath(filePath)
  const {
    loroDoc,
    currentBranch,
    branches,
    isSyncing,
    switchBranch,
    createBranchAuto,
    renameBranch,
    mergeBranch,
    markDirty,
  } = useBranchDoc(filePath)

  if (!node) return null

  const handleCreateBranch = () => {
    createBranchAuto()
  }

  const handleRenameBranch = () => {
    const next = window.prompt("Rename branch", currentBranch)
    if (next && next.trim()) {
      renameBranch(currentBranch, next.trim())
    }
  }

  const handleMergeBranch = async () => {
    // Get list of branches excluding current
    const availableBranches = branches.filter((b) => b !== currentBranch)

    if (availableBranches.length === 0) {
      alert("No other branches available to merge")
      return
    }

    // Simple prompt to select branch
    const sourceBranch = window.prompt(
      `Merge into '${currentBranch}' from branch:\n\nAvailable branches: ${availableBranches.join(", ")}`,
      availableBranches[0]
    )

    if (sourceBranch && availableBranches.includes(sourceBranch)) {
      await mergeBranch(sourceBranch)
    } else if (sourceBranch) {
      alert(`Branch '${sourceBranch}' not found`)
    }
  }

  return (
    <TabsContent value={filePath} className="flex-1 mt-0 border-0">
      <div className="flex flex-col h-full">
        {/* Branch indicator and actions */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Branch: <span className="text-primary">{currentBranch}</span>
            </span>
            {isSyncing && (
              <span className="text-xs text-muted-foreground">(saving...)</span>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <GitBranch className="h-3 w-3" />
                {currentBranch}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={currentBranch}
                onValueChange={(v) => switchBranch(v)}
              >
                {branches.map((b) => (
                  <DropdownMenuRadioItem key={b} value={b}>
                    {b}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleCreateBranch}>
                New branch
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleRenameBranch}>
                Rename branch
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleMergeBranch}>
                Merge branch...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Editor */}
        <div className="flex-1">
          {loroDoc && (
            <div key={`${filePath}::${currentBranch}`}>
              <Tiptap
                title={node.title ?? "Untitled"}
                loroDoc={loroDoc}
                onTitleChange={setTitle}
                onDirty={markDirty}
              />
            </div>
          )}
        </div>
      </div>
    </TabsContent>
  )
}
