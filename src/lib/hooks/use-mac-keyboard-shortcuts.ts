import { useEffect } from "react"

export interface KeyboardShortcutConfig {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  preventDefault?: boolean
}

interface MacKeyboardShortcut extends KeyboardShortcutConfig {
  handler: (event: KeyboardEvent) => void
}

/**
 * Detects if the current platform is macOS
 */
export function isMac(): boolean {
  if (typeof window === "undefined") return false
  return (
    /Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
    /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
  )
}

/**
 * Creates a keyboard shortcut configuration optimized for Mac
 * Uses Cmd (metaKey) on Mac, Ctrl (ctrlKey) on other platforms
 */
export function createMacShortcut(
  key: string,
  options: Omit<KeyboardShortcutConfig, "key"> & {
    useCtrl?: boolean // Force ctrl instead of cmd on Mac
  } = {}
): KeyboardShortcutConfig {
  const { useCtrl = false, ...rest } = options
  const useMeta = isMac() && !useCtrl

  return {
    key,
    metaKey: useMeta ? true : false,
    ctrlKey: useMeta ? false : true,
    preventDefault: true,
    ...rest,
  }
}

/**
 * Hook for managing Mac-optimized keyboard shortcuts
 */
export function useMacKeyboardShortcuts(
  shortcuts: MacKeyboardShortcut[],
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault()
            event.stopPropagation()
          }
          shortcut.handler(event)
          break
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [shortcuts, enabled])
}

/**
 * Checks if a keyboard event matches a shortcut configuration
 */
function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcutConfig
): boolean {
  return (
    event.key === shortcut.key &&
    !!event.metaKey === !!shortcut.metaKey &&
    !!event.ctrlKey === !!shortcut.ctrlKey &&
    !!event.shiftKey === !!shortcut.shiftKey &&
    !!event.altKey === !!shortcut.altKey
  )
}
