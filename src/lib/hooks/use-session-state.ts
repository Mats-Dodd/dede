import { useCallback, useState, useEffect } from "react"
import { createCollection, type Collection } from "@tanstack/react-db"
import { localStorageCollectionOptions } from "@tanstack/react-db"
import {
  type SessionState,
  sessionStateSchema,
} from "@/lib/session-state-schema"

// Create a stable collection instance outside the component
let sessionStateCollection: Collection<SessionState> | null = null

function getSessionStateCollection(): Collection<SessionState> | null {
  if (typeof window === "undefined") {
    return null
  }

  if (!sessionStateCollection) {
    sessionStateCollection = createCollection(
      localStorageCollectionOptions({
        id: "session-state",
        storageKey: "arbor-editor-session-state",
        getKey: (item) => item.id,
        schema: sessionStateSchema,
      })
    )

    // Preload data from localStorage
    try {
      if (sessionStateCollection.preload) {
        sessionStateCollection.preload()
      }
    } catch (_error) {
      // Ignore preload errors
    }
  }

  return sessionStateCollection
}

export function useSessionState(projectId: number) {
  const [currentState, setCurrentState] = useState<SessionState | undefined>()
  const [collection, setCollection] = useState<Collection<SessionState> | null>(
    null
  )

  // Create collection only on client side
  useEffect(() => {
    if (typeof window !== "undefined" && !collection) {
      const newCollection = getSessionStateCollection()
      setCollection(newCollection)
    }
  }, [collection])

  // Query the collection when it's available
  useEffect(() => {
    if (collection && projectId) {
      // Force preload in case it wasn't called during creation
      try {
        if (collection.preload) {
          collection.preload()
        }
      } catch (_error) {
        // Ignore preload errors
      }

      // Get current state from collection
      const items = collection.toArray
      const state = items.find(
        (item: SessionState) => item.projectId === projectId
      )
      setCurrentState(state)
    }
  }, [collection, projectId])

  const saveSessionState = useCallback(
    (
      state: Partial<Omit<SessionState, "id" | "projectId" | "lastUpdated">>
    ) => {
      if (!collection) {
        return
      }

      const stateId = projectId.toString()
      const existingState = currentState

      if (existingState) {
        collection.update(stateId, (draft) => {
          Object.assign(draft, { ...state, lastUpdated: new Date() })
        })
      } else {
        const newState = {
          id: stateId,
          projectId,
          openFileIds: [],
          openFilePaths: [],
          activeFilePath: undefined,
          tabOrder: [],
          lastUpdated: new Date(),
          ...state,
        }
        collection.insert(newState)
      }
    },
    [projectId, currentState, collection]
  )

  const clearSessionState = useCallback(() => {
    if (!collection) return

    const stateId = projectId.toString()
    if (currentState) {
      collection.delete(stateId)
    }
  }, [projectId, currentState, collection])

  return {
    currentState,
    saveSessionState,
    clearSessionState,
    hasSessionState: !!currentState,
  }
}
