/**
 * CategoryHierarchyViewer Component
 *
 * Displays all categories in a hierarchical tree structure.
 * Users can use this to evaluate category agent results.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Dialog } from '@/components/ui/Dialog'
import { Toast } from '@/components/ui/Toast'
import { ChevronRight, ChevronDown, FolderTree, Search } from 'lucide-react'

interface CategoryHierarchyViewerProps {
  open: boolean
  onClose: () => void
}

interface CategoryNode {
  name: string
  level: number
  children: CategoryNode[]
  path: string
}

export function CategoryHierarchyViewer({ open, onClose }: CategoryHierarchyViewerProps) {
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [totalPaths, setTotalPaths] = useState(0) // Track total unique paths from DB
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    if (open) {
      fetchCategories()
    }
  }, [open])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      // Fetch all unique category paths from categories_hierarchical table
      const { data, error } = await supabase
        .from('categories_hierarchical')
        .select('path')
        .not('path', 'is', null)

      if (error) throw error

      if (!data || data.length === 0) {
        setToast({ message: 'No categories found in database', type: 'info' })
        return
      }

      // Build hierarchy from category paths
      const categoryPaths = [...new Set(data.map((item) => item.path as string))]
      setTotalPaths(categoryPaths.length) // Store total unique paths
      const hierarchy = buildCategoryHierarchy(categoryPaths)
      setCategories(hierarchy)

      // Auto-expand all nodes on initial load
      const allPaths = new Set<string>()
      const collectPaths = (nodes: CategoryNode[]) => {
        nodes.forEach((node) => {
          if (node.children.length > 0) {
            allPaths.add(node.path)
          }
          collectPaths(node.children)
        })
      }
      collectPaths(hierarchy)
      setExpandedNodes(allPaths)
    } catch (error: any) {
      console.error('Error fetching categories:', error)
      setToast({ message: `Failed to load categories: ${error.message}`, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const buildCategoryHierarchy = (paths: string[]): CategoryNode[] => {
    const root: CategoryNode[] = []
    const nodeMap = new Map<string, CategoryNode>()

    paths.forEach((path) => {
      const parts = path.split(' > ').map((p) => p.trim())
      let currentLevel = root
      let currentPath = ''

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath} > ${part}` : part
        
        if (!nodeMap.has(currentPath)) {
          const node: CategoryNode = {
            name: part,
            level: index,
            children: [],
            path: currentPath,
          }
          nodeMap.set(currentPath, node)
          currentLevel.push(node)
        }

        const node = nodeMap.get(currentPath)!
        currentLevel = node.children
      })
    })

    return sortCategories(root)
  }

  const sortCategories = (nodes: CategoryNode[]): CategoryNode[] => {
    return nodes
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((node) => ({
        ...node,
        children: sortCategories(node.children),
      }))
  }

  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedNodes(newExpanded)
  }

  const expandAll = () => {
    const allPaths = new Set<string>()
    const collectPaths = (nodes: CategoryNode[]) => {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          allPaths.add(node.path)
        }
        collectPaths(node.children)
      })
    }
    // Use base categories, not filtered ones
    collectPaths(categories)
    setExpandedNodes(allPaths)
  }

  const collapseAll = () => {
    setExpandedNodes(new Set())
  }

  const filterCategories = (nodes: CategoryNode[], term: string): CategoryNode[] => {
    if (!term) return nodes

    const lowerTerm = term.toLowerCase()
    return nodes
      .map((node) => {
        const matchesName = node.name.toLowerCase().includes(lowerTerm)
        const filteredChildren = filterCategories(node.children, term)

        if (matchesName || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          }
        }
        return null
      })
      .filter((node): node is CategoryNode => node !== null)
  }

  const renderCategoryNode = (node: CategoryNode) => {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedNodes.has(node.path)

    return (
      <div key={node.path} className="select-none">
        <div
          className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded cursor-pointer group"
          onClick={() => hasChildren && toggleNode(node.path)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
            )
          ) : (
            <span className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="text-sm text-gray-700 group-hover:text-gray-900">
            {node.name}
          </span>
          {hasChildren && (
            <span className="text-xs text-gray-400 ml-auto">
              ({node.children.length})
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-6 border-l border-gray-200 pl-2">
            {node.children.map((child) => renderCategoryNode(child))}
          </div>
        )}
      </div>
    )
  }

  const filteredCategories = filterCategories(categories, searchTerm)
  const totalCategories = categories.reduce((count, node) => {
    const countNodes = (n: CategoryNode): number => {
      return 1 + n.children.reduce((sum, child) => sum + countNodes(child), 0)
    }
    return count + countNodes(node)
  }, 0)

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Category Hierarchy">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <FolderTree className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Category Hierarchy Browser</p>
                <p className="mt-1">
                  Browse all available categories from the database. Use this to evaluate Category Agent results and find the correct category paths for products.
                </p>
              </div>
            </div>
          </div>

          {/* Search and Controls */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={expandAll}
              className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Collapse All
            </button>
          </div>

          {/* Category Tree */}
          <div className="border border-gray-200 rounded-lg p-4 bg-white max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="space-y-2 animate-pulse">
                {/* Shimmer skeleton for category tree */}
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5">
                    <div className="w-4 h-4 bg-gray-200 rounded flex-shrink-0"></div>
                    <div
                      className="h-4 bg-gray-200 rounded"
                      style={{ width: `${Math.random() * 40 + 30}%`, marginLeft: `${(i % 3) * 24}px` }}
                    ></div>
                  </div>
                ))}
              </div>
            ) : filteredCategories.length > 0 ? (
              <div className="space-y-1">
                {filteredCategories.map((node) => renderCategoryNode(node))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                {searchTerm ? 'No categories match your search' : 'No categories found'}
              </div>
            )}
          </div>

          {/* Stats */}
          {!loading && categories.length > 0 && (
            <div className="text-sm text-gray-600 text-center">
              <div>Total unique category nodes: {totalCategories}</div>
              <div className="text-xs text-gray-500 mt-1">
                ({totalPaths.toLocaleString()} unique paths in database)
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </Dialog>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}
