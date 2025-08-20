"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface BranchRenameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBranchName: string
  onRename: (newName: string) => void
}

export function BranchRenameDialog({
  open,
  onOpenChange,
  currentBranchName,
  onRename,
}: BranchRenameDialogProps) {
  const [newName, setNewName] = useState(currentBranchName)

  // Sync state with prop changes
  useEffect(() => {
    setNewName(currentBranchName)
  }, [currentBranchName])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newName.trim() && newName.trim() !== currentBranchName) {
      onRename(newName.trim())
      onOpenChange(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setNewName(currentBranchName)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Branch</DialogTitle>
          <DialogDescription>
            Enter a new name for the branch &quot;{currentBranchName}&quot;.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="branch-name">Branch name</Label>
              <Input
                id="branch-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter branch name..."
                autoFocus
              />
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
            <Button
              type="submit"
              disabled={!newName.trim() || newName.trim() === currentBranchName}
            >
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
