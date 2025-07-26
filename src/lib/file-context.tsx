import React, { createContext, useContext, useState, ReactNode } from "react"
import { type FileTreeNode } from "@/lib/file-tree-utils"

interface FileContextType {
  selectedFileNode: FileTreeNode | undefined
  setSelectedFileNode: (node: FileTreeNode | undefined) => void
}

const FileContext = createContext<FileContextType | null>(null)

export function FileProvider({ children }: { children: ReactNode }) {
  const [selectedFileNode, setSelectedFileNode] = useState<
    FileTreeNode | undefined
  >()

  console.log("📁 Context - Current selected file node:", selectedFileNode)

  return (
    <FileContext.Provider value={{ selectedFileNode, setSelectedFileNode }}>
      {children}
    </FileContext.Provider>
  )
}

export function useFileContext() {
  const context = useContext(FileContext)
  if (!context) {
    throw new Error("useFileContext must be used within a FileProvider")
  }
  return context
}
