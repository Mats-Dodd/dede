import { useFileNodeByPath } from "@/lib/hooks/use-file-node"
import { TabsContent } from "@/components/ui/tabs"
import Tiptap from "@/components/editor"
import { useBranchDoc } from "@/lib/hooks/use-branch-doc"
import { Button } from "@/components/ui/button"
import { GitBranch } from "lucide-react"
import { FEATURE_BRANCH, DEFAULT_BRANCH } from "@/lib/crdt/branch-utils"

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
    createBranch,
    markDirty,
  } = useBranchDoc(filePath)

  if (!node) return null

  // Simple toggle between main and feature branches
  const handleBranchToggle = () => {
    if (currentBranch === DEFAULT_BRANCH) {
      // Create feature branch if it doesn't exist, or switch to it
      if (!branches.includes(FEATURE_BRANCH)) {
        createBranch(FEATURE_BRANCH)
      } else {
        switchBranch(FEATURE_BRANCH)
      }
    } else {
      switchBranch(DEFAULT_BRANCH)
    }
  }

  return (
    <TabsContent value={filePath} className="flex-1 mt-0 border-0">
      <div className="flex flex-col h-full">
        {/* Branch indicator and toggle */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleBranchToggle}
            className="gap-2"
          >
            <GitBranch className="h-3 w-3" />
            Switch to{" "}
            {currentBranch === DEFAULT_BRANCH ? FEATURE_BRANCH : DEFAULT_BRANCH}
          </Button>
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
