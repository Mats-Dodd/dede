"use client"

import React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronRight } from "lucide-react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const treeVariants = cva(
  "group hover:before:opacity-100 before:absolute before:rounded-lg before:left-0 px-2 before:w-full before:opacity-0 before:bg-accent/50 before:h-[2rem] before:-z-10 tree-item-smooth"
)

const selectedTreeVariants = cva(
  "before:opacity-100 before:bg-accent/70 text-accent-foreground"
)

interface TreeDataItem {
  id: string
  name: string
  icon?: React.ComponentType<{ className?: string }>
  selectedIcon?: React.ComponentType<{ className?: string }>
  openIcon?: React.ComponentType<{ className?: string }>
  children?: TreeDataItem[]
  actions?: React.ReactNode
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  draggable?: boolean
  droppable?: boolean
  disabled?: boolean
}

type TreeProps = React.HTMLAttributes<HTMLDivElement> & {
  data: TreeDataItem[] | TreeDataItem
  initialSelectedItemId?: string
  onSelectChange?: (item: TreeDataItem | undefined) => void
  expandAll?: boolean
  defaultNodeIcon?: React.ComponentType<{ className?: string }>
  defaultLeafIcon?: React.ComponentType<{ className?: string }>
  onDocumentDrag?: (sourceItem: TreeDataItem, targetItem: TreeDataItem) => void
  onRootDrop?: (item: TreeDataItem) => void
}

const TreeView = React.forwardRef<HTMLDivElement, TreeProps>(
  (
    {
      data,
      initialSelectedItemId,
      onSelectChange,
      expandAll,
      defaultLeafIcon,
      defaultNodeIcon,
      className,
      onDocumentDrag,
      onRootDrop,
      ...props
    },
    ref
  ) => {
    const [selectedItemId, setSelectedItemId] = React.useState<
      string | undefined
    >(initialSelectedItemId)

    const [draggedItem, setDraggedItem] = React.useState<TreeDataItem | null>(
      null
    )

    const handleSelectChange = React.useCallback(
      (item: TreeDataItem | undefined) => {
        setSelectedItemId(item?.id)
        if (onSelectChange) {
          onSelectChange(item)
        }
      },
      [onSelectChange]
    )

    const handleDragStart = React.useCallback((item: TreeDataItem) => {
      setDraggedItem(item)
    }, [])

    const handleDrop = React.useCallback(
      (targetItem: TreeDataItem) => {
        if (draggedItem && onDocumentDrag && draggedItem.id !== targetItem.id) {
          onDocumentDrag(draggedItem, targetItem)
        }
        setDraggedItem(null)
      },
      [draggedItem, onDocumentDrag]
    )

    const expandedItemIds = React.useMemo(() => {
      if (!initialSelectedItemId) {
        return [] as string[]
      }

      const ids: string[] = []

      function walkTreeItems(
        items: TreeDataItem[] | TreeDataItem,
        targetId: string
      ) {
        if (items instanceof Array) {
          for (let i = 0; i < items.length; i++) {
            ids.push(items[i]!.id)
            if (walkTreeItems(items[i]!, targetId) && !expandAll) {
              return true
            }
            if (!expandAll) ids.pop()
          }
        } else if (!expandAll && items.id === targetId) {
          return true
        } else if (items.children) {
          return walkTreeItems(items.children, targetId)
        }
      }

      walkTreeItems(data, initialSelectedItemId)
      return ids
    }, [data, expandAll, initialSelectedItemId])

    return (
      <div className={cn("overflow-hidden relative p-2", className)}>
        <TreeItem
          data={data}
          ref={ref}
          selectedItemId={selectedItemId}
          handleSelectChange={handleSelectChange}
          expandedItemIds={expandedItemIds}
          defaultLeafIcon={defaultLeafIcon}
          defaultNodeIcon={defaultNodeIcon}
          handleDragStart={handleDragStart}
          handleDrop={handleDrop}
          draggedItem={draggedItem}
          {...props}
        />
        <div
          className="w-full h-[48px]"
          onDragOver={(e) => {
            if (draggedItem) {
              e.preventDefault()
              e.dataTransfer.dropEffect = "move"
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (draggedItem && onRootDrop) {
              onRootDrop(draggedItem)
            }
            setDraggedItem(null)
          }}
        ></div>
      </div>
    )
  }
)
TreeView.displayName = "TreeView"

type TreeItemProps = TreeProps & {
  selectedItemId?: string
  handleSelectChange: (item: TreeDataItem | undefined) => void
  expandedItemIds: string[]
  defaultNodeIcon?: React.ComponentType<{ className?: string }>
  defaultLeafIcon?: React.ComponentType<{ className?: string }>
  handleDragStart?: (item: TreeDataItem) => void
  handleDrop?: (item: TreeDataItem) => void
  draggedItem: TreeDataItem | null
}

const TreeItem = React.forwardRef<HTMLDivElement, TreeItemProps>(
  (
    {
      className,
      data,
      selectedItemId,
      handleSelectChange,
      expandedItemIds,
      defaultNodeIcon,
      defaultLeafIcon,
      handleDragStart,
      handleDrop,
      draggedItem,
      ...props
    },
    ref
  ) => {
    if (!(data instanceof Array)) {
      data = [data]
    }
    return (
      <div ref={ref} role="tree" className={className} {...props}>
        <ul>
          {data.map((item) => (
            <li key={item.id}>
              {item.children ? (
                <TreeNode
                  item={item}
                  selectedItemId={selectedItemId}
                  expandedItemIds={expandedItemIds}
                  handleSelectChange={handleSelectChange}
                  defaultNodeIcon={defaultNodeIcon}
                  defaultLeafIcon={defaultLeafIcon}
                  handleDragStart={handleDragStart}
                  handleDrop={handleDrop}
                  draggedItem={draggedItem}
                />
              ) : (
                <TreeLeaf
                  item={item}
                  selectedItemId={selectedItemId}
                  handleSelectChange={handleSelectChange}
                  defaultLeafIcon={defaultLeafIcon}
                  handleDragStart={handleDragStart}
                  handleDrop={handleDrop}
                  draggedItem={draggedItem}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    )
  }
)
TreeItem.displayName = "TreeItem"

const TreeNode = ({
  item,
  handleSelectChange,
  expandedItemIds,
  selectedItemId,
  defaultNodeIcon,
  defaultLeafIcon,
  handleDragStart,
  handleDrop,
  draggedItem,
}: {
  item: TreeDataItem
  handleSelectChange: (item: TreeDataItem | undefined) => void
  expandedItemIds: string[]
  selectedItemId?: string
  defaultNodeIcon?: React.ComponentType<{ className?: string }>
  defaultLeafIcon?: React.ComponentType<{ className?: string }>
  handleDragStart?: (item: TreeDataItem) => void
  handleDrop?: (item: TreeDataItem) => void
  draggedItem: TreeDataItem | null
}) => {
  const [value, setValue] = React.useState(
    expandedItemIds.includes(item.id) ? [item.id] : []
  )
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [justDropped, setJustDropped] = React.useState(false)

  const onDragStart = (e: React.DragEvent) => {
    if (!item.draggable) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData("text/plain", item.id)
    e.dataTransfer.effectAllowed = "move"

    // Hide the default drag image with green plus sign
    const dragImage = new Image()
    dragImage.src =
      "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 1 1'%3e%3c/svg%3e"
    e.dataTransfer.setDragImage(dragImage, 0, 0)

    setIsDragging(true)
    handleDragStart?.(item)
  }

  const onDragEnd = () => {
    setIsDragging(false)
  }

  const onDragOver = (e: React.DragEvent) => {
    if (item.droppable !== false && draggedItem && draggedItem.id !== item.id) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setIsDragOver(true)
    }
  }

  const onDragLeave = () => {
    setIsDragOver(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setJustDropped(true)
    handleDrop?.(item)

    // Reset drop animation after completion
    setTimeout(() => setJustDropped(false), 400)
  }

  return (
    <AccordionPrimitive.Root
      type="multiple"
      value={value}
      onValueChange={(s) => setValue(s)}
    >
      <AccordionPrimitive.Item value={item.id}>
        <AccordionTrigger
          className={cn(
            treeVariants(),
            "tree-item-smooth",
            selectedItemId === item.id && selectedTreeVariants(),
            isDragOver && "tree-item-drop-zone",
            isDragging && "tree-item-dragging",
            justDropped && "tree-item-dropped"
          )}
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              item.onContextMenu?.(e)
            } else {
              handleSelectChange(item)
              item.onClick?.()
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            item.onContextMenu?.(e)
          }}
          draggable={!!item.draggable}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <TreeIcon
            item={item}
            isSelected={selectedItemId === item.id}
            isOpen={value.includes(item.id)}
            default={defaultNodeIcon}
          />
          <span className="text-sm truncate">{item.name}</span>
          <TreeActions isSelected={selectedItemId === item.id}>
            {item.actions}
          </TreeActions>
        </AccordionTrigger>
        <AccordionContent className="ml-4 border-l">
          <TreeItem
            data={item.children ? item.children : item}
            selectedItemId={selectedItemId}
            handleSelectChange={handleSelectChange}
            expandedItemIds={expandedItemIds}
            defaultLeafIcon={defaultLeafIcon}
            defaultNodeIcon={defaultNodeIcon}
            handleDragStart={handleDragStart}
            handleDrop={handleDrop}
            draggedItem={draggedItem}
          />
        </AccordionContent>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  )
}

const TreeLeaf = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    item: TreeDataItem
    selectedItemId?: string
    handleSelectChange: (item: TreeDataItem | undefined) => void
    defaultLeafIcon?: React.ComponentType<{ className?: string }>
    handleDragStart?: (item: TreeDataItem) => void
    handleDrop?: (item: TreeDataItem) => void
    draggedItem: TreeDataItem | null
  }
>(
  (
    {
      className,
      item,
      selectedItemId,
      handleSelectChange,
      defaultLeafIcon,
      handleDragStart,
      handleDrop,
      draggedItem,
      ...props
    },
    ref
  ) => {
    const [isDragOver, setIsDragOver] = React.useState(false)
    const [isDragging, setIsDragging] = React.useState(false)
    const [justDropped, setJustDropped] = React.useState(false)

    const onDragStart = (e: React.DragEvent) => {
      if (!item.draggable || item.disabled) {
        e.preventDefault()
        return
      }
      e.dataTransfer.setData("text/plain", item.id)
      e.dataTransfer.effectAllowed = "move"

      // Hide the default drag image with green plus sign
      const dragImage = new Image()
      dragImage.src =
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 1 1'%3e%3c/svg%3e"
      e.dataTransfer.setDragImage(dragImage, 0, 0)

      setIsDragging(true)
      handleDragStart?.(item)
    }

    const onDragEnd = () => {
      setIsDragging(false)
    }

    const onDragOver = (e: React.DragEvent) => {
      if (
        item.droppable !== false &&
        !item.disabled &&
        draggedItem &&
        draggedItem.id !== item.id
      ) {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        setIsDragOver(true)
      }
    }

    const onDragLeave = () => {
      setIsDragOver(false)
    }

    const onDrop = (e: React.DragEvent) => {
      if (item.disabled) return
      e.preventDefault()
      setIsDragOver(false)
      setJustDropped(true)
      handleDrop?.(item)

      // Reset drop animation after completion
      setTimeout(() => setJustDropped(false), 400)
    }

    return (
      <div
        ref={ref}
        className={cn(
          "ml-5 flex text-left items-center py-2 cursor-pointer before:right-1",
          treeVariants(),
          "tree-item-smooth",
          className,
          selectedItemId === item.id && selectedTreeVariants(),
          isDragOver && "tree-item-drop-zone",
          isDragging && "tree-item-dragging",
          justDropped && "tree-item-dropped",
          item.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
        onClick={(e) => {
          if (item.disabled) return
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            item.onContextMenu?.(e)
          } else {
            handleSelectChange(item)
            item.onClick?.()
          }
        }}
        onContextMenu={(e) => {
          if (item.disabled) return
          e.preventDefault()
          item.onContextMenu?.(e)
        }}
        draggable={!!item.draggable && !item.disabled}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        {...props}
      >
        <TreeIcon
          item={item}
          isSelected={selectedItemId === item.id}
          default={defaultLeafIcon}
        />
        <span className="flex-grow text-sm truncate">{item.name}</span>
        <TreeActions isSelected={selectedItemId === item.id && !item.disabled}>
          {item.actions}
        </TreeActions>
      </div>
    )
  }
)

TreeLeaf.displayName = "TreeLeaf"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header>
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 w-full items-center py-2 transition-all first:[&[data-state=open]>svg]:rotate-90",
        className
      )}
      {...props}
    >
      <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 text-accent-foreground/50 mr-1" />
      {children}
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      className
    )}
    {...props}
  >
    <div className="pb-1 pt-0">{children}</div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

const TreeIcon = ({
  item,
  isOpen,
  isSelected,
  default: defaultIcon,
}: {
  item: TreeDataItem
  isOpen?: boolean
  isSelected?: boolean
  default?: React.ComponentType<{ className?: string }>
}) => {
  let Icon = defaultIcon
  if (isSelected && item.selectedIcon) {
    Icon = item.selectedIcon
  } else if (isOpen && item.openIcon) {
    Icon = item.openIcon
  } else if (item.icon) {
    Icon = item.icon
  }
  return Icon ? <Icon className="h-4 w-4 shrink-0 mr-2" /> : <></>
}

const TreeActions = ({
  children,
  isSelected,
}: {
  children: React.ReactNode
  isSelected: boolean
}) => {
  return (
    <div
      className={cn(
        isSelected ? "block" : "hidden",
        "absolute right-3 group-hover:block"
      )}
    >
      {children}
    </div>
  )
}

export { TreeView }
export type { TreeDataItem }
