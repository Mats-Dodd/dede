import { describe, it, expect, beforeEach, vi } from "vitest"

// First, mock the collections module so that path-utils picks up the mock.
vi.mock("@/lib/collections", () => {
  return {
    fileSystemNodeCollection: {
      update: vi.fn(),
    },
  }
})

import {
  getParentPath,
  joinPaths,
  updateChildPaths,
  updateNodePath,
} from "./path-utils"
import { fileSystemNodeCollection } from "@/lib/collections"

const mockUpdate = fileSystemNodeCollection.update as unknown as ReturnType<
  typeof vi.fn
>

type MinimalNode = {
  id: number | string
  path: string
  title?: string
  type: "file" | "directory"
}

describe("path-utils", () => {
  beforeEach(() => {
    mockUpdate.mockReset()
  })

  it("getParentPath should return correct parent", () => {
    expect(getParentPath("/a/b/c")).toBe("/a/b")
    expect(getParentPath("/foo")).toBeNull()
    expect(getParentPath("/")).toBeNull()
  })

  it("joinPaths should combine paths properly", () => {
    expect(joinPaths("/", "foo")).toBe("/foo")
    expect(joinPaths("/bar", "baz")).toBe("/bar/baz")
  })

  it("updateChildPaths should update descendant nodes", () => {
    const nodes: MinimalNode[] = [
      { id: 1, path: "/foo/bar", type: "file" },
      { id: 2, path: "/foo/baz/qux", type: "file" },
      { id: 3, path: "/unrelated", type: "file" },
    ]

    updateChildPaths("/foo", "/fooRenamed", nodes as any)

    // Two descendants under /foo should be updated
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(mockUpdate).toHaveBeenNthCalledWith(1, "1", expect.any(Function))
    expect(mockUpdate).toHaveBeenNthCalledWith(2, "2", expect.any(Function))
  })

  it("updateNodePath should update node and its children when directory", () => {
    const nodes: MinimalNode[] = [
      { id: 1, path: "/dir", type: "directory" },
      { id: 2, path: "/dir/child", type: "file" },
    ]

    updateNodePath(nodes[0] as any, "/renamed", nodes as any)

    // update called for directory and its child
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(mockUpdate).toHaveBeenCalledWith("1", expect.any(Function))
    expect(mockUpdate).toHaveBeenCalledWith("2", expect.any(Function))
  })
})
