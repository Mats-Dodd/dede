import { useFileNodeByPath } from "@/lib/hooks/use-file-node"
import { TabsContent } from "@/components/ui/tabs"
import Tiptap from "@/components/editor"
import { useBranchDoc } from "@/lib/hooks/use-branch-doc"
import { Button } from "@/components/ui/button"
import { GitBranch, ChevronDown, GitCompare } from "lucide-react"
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
import { useState } from "react"
import { getBranchSnapshot } from "@/lib/crdt/branch-utils"
import { base64ToBytes } from "@/types/crdt"
import { LoroDoc } from "loro-crdt"
import { Editor, Extension } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { LoroSyncPlugin, LoroUndoPlugin } from "loro-prosemirror"
import type { JSONContent } from "@tiptap/core"

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
  const [isDiffMode, setIsDiffMode] = useState(false)
  const [diffContent, setDiffContent] = useState<JSONContent | null>(null)

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

  const handleCompareWithMain = async () => {
    if (currentBranch === "main") {
      alert("You are already on the main branch")
      return
    }

    try {
      // Load main branch snapshot
      const mainSnapshot = getBranchSnapshot(node, "main")
      if (!mainSnapshot) {
        alert("Could not load main branch")
        return
      }

      // Convert snapshot to Tiptap JSON
      const doc = new LoroDoc()
      const bytes = base64ToBytes(mainSnapshot)
      doc.import(bytes)

      // Create a temporary element to extract Tiptap JSON
      const tempDiv = document.createElement("div")
      tempDiv.style.display = "none"
      document.body.appendChild(tempDiv)

      const tempEditor = new Editor({
        element: tempDiv,
        extensions: [
          StarterKit,
          Extension.create({
            name: "loro",
            addProseMirrorPlugins() {
              return [
                LoroSyncPlugin({
                  doc: doc as unknown as Parameters<
                    typeof LoroSyncPlugin
                  >[0]["doc"],
                }),
                LoroUndoPlugin({
                  doc: doc as unknown as Parameters<
                    typeof LoroUndoPlugin
                  >[0]["doc"],
                }),
              ]
            },
          }),
        ],
        content: "",
      })

      // Wait for the editor to sync with Loro
      await new Promise((resolve) => setTimeout(resolve, 200))

      const mainTiptapJson = tempEditor.getJSON()
      console.log("Main branch Tiptap JSON:", mainTiptapJson)

      tempEditor.destroy()
      document.body.removeChild(tempDiv)

      // Set diff mode with the main branch content
      setDiffContent(mainTiptapJson)
      setIsDiffMode(true)
    } catch (error) {
      console.error("Failed to compare with main:", error)
      alert("Failed to load main branch for comparison")
    }
  }

  const handleExitDiffMode = () => {
    setIsDiffMode(false)
    setDiffContent(null)
  }

  return (
    <TabsContent value={filePath} className="flex-1 mt-0 border-0">
      <div className="flex flex-col h-full">
        {/* Branch indicator and actions */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            {isDiffMode ? (
              <>
                <GitCompare className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">
                  Comparing:{" "}
                  <span className="text-blue-600">{currentBranch}</span>
                  {" → "}
                  <span className="text-blue-600">main</span>
                </span>
              </>
            ) : (
              <>
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Branch: <span className="text-primary">{currentBranch}</span>
                </span>
                {isSyncing && (
                  <span className="text-xs text-muted-foreground">
                    (saving...)
                  </span>
                )}
              </>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {isDiffMode ? (
                  <>
                    <GitCompare className="h-3 w-3" />
                    Comparing with main
                  </>
                ) : (
                  <>
                    <GitBranch className="h-3 w-3" />
                    {currentBranch}
                  </>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isDiffMode ? (
                <>
                  <DropdownMenuItem onSelect={handleExitDiffMode}>
                    <GitBranch className="h-3 w-3 mr-2" />
                    Exit Comparison
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={currentBranch}
                onValueChange={(v) => !isDiffMode && switchBranch(v)}
              >
                {branches.map((b) => (
                  <DropdownMenuRadioItem
                    key={b}
                    value={b}
                    disabled={isDiffMode}
                  >
                    {b}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleCreateBranch}
                disabled={isDiffMode}
              >
                New branch
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleRenameBranch}
                disabled={isDiffMode}
              >
                Rename branch
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleMergeBranch}
                disabled={isDiffMode}
              >
                Merge branch...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {currentBranch !== "main" && !isDiffMode && (
                <DropdownMenuItem onSelect={handleCompareWithMain}>
                  <GitCompare className="h-3 w-3 mr-2" />
                  Compare with main
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Editor */}
        <div className="flex-1">
          {loroDoc && (
            <div key={`${filePath}::${currentBranch}::${isDiffMode}`}>
              <Tiptap
                title={node.title ?? "Untitled"}
                loroDoc={loroDoc}
                onTitleChange={setTitle}
                onDirty={markDirty}
                diffMode={isDiffMode}
                diffContent={diffContent}
              />
            </div>
          )}
        </div>
      </div>
    </TabsContent>
  )
}
