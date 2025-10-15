/**
 * WeightDimensionTable Component
 *
 * Displays a table of products with weight and dimension data.
 * Includes filtering, sorting, pagination, and links to product detail pages.
 */

'use client'

import { useState, useMemo } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Eye, Package, Scale, ArrowUpDown } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Pagination } from '@/components/ui/Pagination'
import { AdvancedFilterButton } from '@/components/ui/AdvancedFilterButton'

interface WeightDimensionTableProps {
  products: any[]
}

export default function WeightDimensionTable({ products }: WeightDimensionTableProps) {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const [sort, setSort] = useState({ key: 'updated_at', order: 'desc' })

  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const perPage = 20

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aValue = a[sort.key]
      const bValue = b[sort.key]

      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      if (sort.order === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  }, [products, sort])

  const paginatedProducts = sortedProducts.slice(
    (page - 1) * perPage,
    page * perPage
  )

  const handleSort = (key: string) => {
    if (sort.key === key) {
      setSort({ key, order: sort.order === 'asc' ? 'desc' : 'asc' })
    } else {
      setSort({ key, order: 'desc' })
    }
  }

  const hasAdvancedFilters = Array.from(searchParams.entries()).some(([key]) => key.startsWith('filter['))

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Products</h2>
        <div className="flex items-center gap-2">
          <AdvancedFilterButton hasAdvancedFilters={hasAdvancedFilters} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Status
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('weight_confidence')}
              >
                <div className="flex items-center gap-1">
                  Confidence
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Weight & Dimensions
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('updated_at')}
              >
                <div className="flex items-center gap-1">
                  Last Updated
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProducts.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    {product.main_image ? (
                      <img
                        src={product.main_image}
                        alt={product.name}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {product.vendor} - {product.item_code}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={product.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <ConfidenceBadge confidence={product.weight_confidence} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  <div className="flex items-center gap-1">
                    <Scale className="h-4 w-4 text-gray-500" />
                    <span>{product.weight ? `${product.weight} kg` : 'N/A'}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {product.length || product.width || product.height
                      ? `L: ${product.length ?? '?'} W: ${
                          product.width ?? '?'
                        } H: ${product.height ?? '?'} cm`
                      : 'No dimensions'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDateTime(product.updated_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    to={`/scraper-agent/${product.item_code}`}
                    className="text-indigo-600 hover:text-indigo-900 inline-flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {products.length > perPage && (
        <div className="px-6 py-4 border-t border-gray-200">
          <Pagination
            currentPage={page}
            totalCount={products.length}
            pageSize={perPage}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
          />
        </div>
      )}
    </div>
  )
}
