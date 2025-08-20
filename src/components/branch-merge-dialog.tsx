"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface BranchMergeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBranch: string
  availableBranches: string[]
  onMerge: (targetBranch: string) => void
}

export function BranchMergeDialog({
  open,
  onOpenChange,
  currentBranch,
  availableBranches,
  onMerge,
}: BranchMergeDialogProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedBranch && availableBranches.includes(selectedBranch)) {
      onMerge(selectedBranch)
      onOpenChange(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (open && availableBranches.length > 0) {
      setSelectedBranch(availableBranches[0])
    } else {
      setSelectedBranch("")
    }
    onOpenChange(open)
  }

  if (availableBranches.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No Branches Available</DialogTitle>
            <DialogDescription>
              There are no other branches available to merge &quot;
              {currentBranch}&quot; into.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge Branch</DialogTitle>
          <DialogDescription>
            Select a target branch to merge &quot;{currentBranch}&quot; into.
            This will combine the changes from your current branch into the
            selected branch and switch you to that branch.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="target-branch">Target branch</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a branch to merge into..." />
                </SelectTrigger>
                <SelectContent>
                  {availableBranches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedBranch}>
              Merge
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
