/**
 * ProductDetailPage Component
 *
 * Displays detailed product information with agent processing data.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Tags, Package, Search, Code } from 'lucide-react'
import { productsService } from '@/services'
import { ShimmerLoader } from '@/components/ui/ShimmerLoader'
import { ProductHeader } from '@/components/products/ProductHeader'
import { ProductTabs, type Tab } from '@/components/products/ProductTabs'
import { OverviewTab } from '@/components/products/tabs/OverviewTab'
import { CategoryTab } from '@/components/products/tabs/CategoryTab'
import { WeightDimensionTab } from '@/components/products/tabs/WeightDimensionTab'
import { SeoTab } from '@/components/products/tabs/SeoTab'
import { RawDataTab } from '@/components/products/tabs/RawDataTab'

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const fetchProduct = async () => {
      setLoading(true)
      const { product: data, error: err } = await productsService.getProductWithAgentData(id)

      if (err || !data) {
        setError('Product not found')
        setLoading(false)
        return
      }

      setProduct(data)
      setLoading(false)
    }

    fetchProduct()
  }, [id])

  const handleRetry = () => {
    // Refresh the page to get updated data
    window.location.reload()
  }

  if (loading) {
    return <ShimmerLoader type="product-detail" />
  }

  if (error || !product) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-600 mb-4">{error || 'Product not found'}</p>
        <button
          onClick={() => navigate('/products')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Products
        </button>
      </div>
    )
  }

  // Create tabs configuration
  const tabs: Tab[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <FileText className="h-4 w-4" />,
      content: (
        <OverviewTab
          description={product.description || product.ai_description || undefined}
          createdAt={product.created_at || undefined}
          updatedAt={product.timestamp || undefined}
        />
      ),
    },
    {
      id: 'category',
      label: 'Category Mapping',
      icon: <Tags className="h-4 w-4" />,
      content: (
        <CategoryTab
          productId={product.id}
          status={product.category_status || 'pending'}
          categoryMapped={product.category_mapped}
          breadcrumbs={product.breadcrumbs}
          reasoning={product.category_reasoning}
          confidence={product.category_confidence}
          toolsUsed={product.category_tools_used}
          feedback={product.category_feedback}
          updatedAt={product.updated_at}
          onRetry={handleRetry}
        />
      ),
    },
    {
      id: 'weight-dimension',
      label: 'Weight & Dimensions',
      icon: <Package className="h-4 w-4" />,
      content: (
        <WeightDimensionTab
          productId={product.id}
          status={product.weight_and_dimension_status || 'pending'}
          weightValue={product.weight_value}
          weightUnit={product.weight_unit}
          contentWeight={product.content_weight}
          packagingWeight={product.packaging_weight}
          widthValue={product.width_value}
          heightValue={product.height_value}
          lengthValue={product.length_value}
          dimensionUnit={product.dimension_unit}
          volumetricWeight={product.volumetric_weight}
          materialType={product.material_type}
          density={product.density}
          structure={product.structure}
          itemType={product.item_type}
          itemCount={product.item_count}
          containerType={product.container_type}
          source={product.source}
          internetSources={product.internet_sources}
          weightConfidence={product.weight_confidence}
          weightReasoning={product.weight_reasoning}
          weightToolsUsed={product.weight_tools_used}
          dimensionConfidence={product.dimension_confidence}
          dimensionReasoning={product.dimension_reasoning}
          dimensionToolsUsed={product.dimension_tools_used}
          errorMessage={product.weight_dimension_error}
          feedback={product.weight_dimension_feedback}
          glbUrl={product.glb_url}
          updatedAt={product.updated_at}
          onRetry={handleRetry}
        />
      ),
    },
    {
      id: 'seo',
      label: 'SEO Optimization',
      icon: <Search className="h-4 w-4" />,
      content: (
        <SeoTab
          productId={product.id}
          status={product.seo_status || 'pending'}
          optimizedTitle={product.optimized_title}
          optimizedDescription={product.optimized_description}
          keywordsUsed={product.keywords_used}
          reasoning={product.seo_reasoning}
          confidence={product.seo_confidence}
          toolsUsed={product.seo_tools_used}
          feedback={product.seo_feedback}
          updatedAt={product.updated_at}
          onRetry={handleRetry}
        />
      ),
    },
    {
      id: 'raw-data',
      label: 'Raw Data',
      icon: <Code className="h-4 w-4" />,
      content: <RawDataTab data={product} />,
    },
  ]

  // Calculate agent statuses for summary cards
  const categoryStatus = product.category_status || 'pending'
  const weightStatus = product.weight_and_dimension_status || 'pending'
  const seoStatus = product.seo_status || 'pending'

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-500'
      case 'failed': return 'text-red-500'
      case 'processing': return 'text-blue-500'
      default: return 'text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'complete': return 'Complete'
      case 'failed': return 'Failed'
      case 'processing': return 'Processing'
      default: return 'Pending'
    }
  }

  return (
    <div className="space-y-6">
      {/* Product Header */}
      <ProductHeader
        name={product.name || 'Unknown Product'}
        code={product.product_id || undefined}
        vendor={product.vendor || undefined}
        price={product.price || undefined}
        imageUrl={product.main_image || undefined}
        productUrl={product.url || undefined}
      />

      {/* Agent Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Category Agent */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase mb-2">Category Mapping</p>
              <p className={`text-sm font-semibold ${getStatusColor(categoryStatus)}`}>
                {getStatusText(categoryStatus)}
              </p>
              {product.category_mapped && (
                <p className="text-xs text-gray-600 mt-1 truncate">{product.category_mapped}</p>
              )}
            </div>
            <Tags className={`h-6 w-6 ${getStatusColor(categoryStatus)}`} />
          </div>
        </div>

        {/* Weight & Dimension Agent */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase mb-2">Weight & Dimensions</p>
              <p className={`text-sm font-semibold ${getStatusColor(weightStatus)}`}>
                {getStatusText(weightStatus)}
              </p>
              {product.weight_value && (
                <p className="text-xs text-gray-600 mt-1">
                  {product.weight_value} {product.weight_unit || 'kg'}
                </p>
              )}
            </div>
            <Package className={`h-6 w-6 ${getStatusColor(weightStatus)}`} />
          </div>
        </div>

        {/* SEO Agent */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase mb-2">SEO Optimization</p>
              <p className={`text-sm font-semibold ${getStatusColor(seoStatus)}`}>
                {getStatusText(seoStatus)}
              </p>
              {product.optimized_title && (
                <p className="text-xs text-gray-600 mt-1 truncate">{product.optimized_title}</p>
              )}
            </div>
            <Search className={`h-6 w-6 ${getStatusColor(seoStatus)}`} />
          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <ProductTabs tabs={tabs} />
    </div>
  )
}
