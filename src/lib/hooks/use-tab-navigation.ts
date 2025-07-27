import { useCallback } from "react"
import { useFileContext } from "@/lib/file-context"

export interface TabNavigationActions {
  goToNextTab: () => void
  goToPreviousTab: () => void
  goToTabByIndex: (index: number) => void
  goToLastTab: () => void
  closeCurrentTab: () => void
  closeAllTabs: () => void
}

/**
 * Hook providing Mac-optimized tab navigation functionality
 */
export function useTabNavigation(): TabNavigationActions {
  const { openFiles, activeFileId, setActiveFile, closeFile } = useFileContext()

  const getCurrentTabIndex = useCallback((): number => {
    if (!activeFileId || openFiles.length === 0) return -1
    return openFiles.findIndex(
      (file) => file.fileSystemNode.id.toString() === activeFileId
    )
  }, [activeFileId, openFiles])

  const goToNextTab = useCallback(() => {
    if (openFiles.length <= 1) return

    const currentIndex = getCurrentTabIndex()
    if (currentIndex === -1) return

    // Circular navigation: go to first tab if at the end
    const nextIndex = (currentIndex + 1) % openFiles.length
    const nextFile = openFiles[nextIndex]
    if (nextFile) {
      setActiveFile(nextFile.fileSystemNode.id.toString())
    }
  }, [openFiles, getCurrentTabIndex, setActiveFile])

  const goToPreviousTab = useCallback(() => {
    if (openFiles.length <= 1) return

    const currentIndex = getCurrentTabIndex()
    if (currentIndex === -1) return

    // Circular navigation: go to last tab if at the beginning
    const previousIndex =
      currentIndex === 0 ? openFiles.length - 1 : currentIndex - 1
    const previousFile = openFiles[previousIndex]
    if (previousFile) {
      setActiveFile(previousFile.fileSystemNode.id.toString())
    }
  }, [openFiles, getCurrentTabIndex, setActiveFile])

  const goToTabByIndex = useCallback(
    (index: number) => {
      // Convert from 1-based index (Cmd+1, Cmd+2, etc.) to 0-based
      const tabIndex = index - 1

      if (tabIndex < 0 || tabIndex >= openFiles.length) return

      const targetFile = openFiles[tabIndex]
      if (targetFile) {
        setActiveFile(targetFile.fileSystemNode.id.toString())
      }
    },
    [openFiles, setActiveFile]
  )

  const goToLastTab = useCallback(() => {
    if (openFiles.length === 0) return

    const lastFile = openFiles[openFiles.length - 1]
    if (lastFile) {
      setActiveFile(lastFile.fileSystemNode.id.toString())
    }
  }, [openFiles, setActiveFile])

  const closeCurrentTab = useCallback(() => {
    if (!activeFileId) return
    closeFile(activeFileId)
  }, [activeFileId, closeFile])

  const closeAllTabs = useCallback(() => {
    // Close tabs in reverse order to avoid index shifting issues
    for (let i = openFiles.length - 1; i >= 0; i--) {
      const file = openFiles[i]
      if (file) {
        closeFile(file.fileSystemNode.id.toString())
      }
    }
  }, [openFiles, closeFile])

  return {
    goToNextTab,
    goToPreviousTab,
    goToTabByIndex,
    goToLastTab,
    closeCurrentTab,
    closeAllTabs,
  }
}
