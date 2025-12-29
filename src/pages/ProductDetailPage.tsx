/**
 * ProductDetailPage Component
 *
 * Displays detailed product information with agent processing data.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { FileText, Tags, Package, Search, Code, ChevronRight, Home, Shield, Package2, AlertTriangle } from 'lucide-react'
import { productsService, erpnextService } from '@/services'
import { ShimmerLoader } from '@/components/ui/ShimmerLoader'
import { ProductHeader } from '@/components/products/ProductHeader'
import { ProductTabs, type Tab } from '@/components/products/ProductTabs'
import { OverviewTab } from '@/components/products/tabs/OverviewTab'
import { CategoryTab } from '@/components/products/tabs/CategoryTab'
import { WeightDimensionTab } from '@/components/products/tabs/WeightDimensionTab'
import { SeoTab } from '@/components/products/tabs/SeoTab'
import { CopyrightTab } from '@/components/products/tabs/CopyrightTab'
import { VariantsTab } from '@/components/products/tabs/VariantsTab'
import { RawDataTab } from '@/components/products/tabs/RawDataTab'
import { RetryButton } from '@/components/ui/RetryButton'
import { useToast } from '@/hooks/useToast'
import { EditProductDialog, type EditProductData } from '@/components/products/EditProductDialog'
import { PriceComparisonDialog } from '@/components/products/PriceComparisonDialog'

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingPin, setTogglingPin] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [priceCompareOpen, setPriceCompareOpen] = useState(false)

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

  const handleTogglePin = async () => {
    if (!product?.id) return

    setTogglingPin(true)

    try {
      const newPinnedState = !product.pinned
      const { success, error } = await productsService.togglePinProduct(
        product.id,
        newPinnedState
      )

      if (error || !success) {
        throw error || new Error('Failed to update pin status')
      }

      // Update local state
      setProduct({ ...product, pinned: newPinnedState })
      showToast(
        newPinnedState ? 'Product pinned successfully' : 'Product unpinned successfully',
        'success'
      )
    } catch (err: any) {
      console.error('Error toggling pin:', err)
      showToast(`Failed to toggle pin: ${err.message}`, 'error')
    } finally {
      setTogglingPin(false)
    }
  }

  const handleEdit = () => {
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async (data: EditProductData) => {
    if (!product?.id) return

    setSavingEdit(true)

    try {
      const { success, product: updatedProduct, error } = await productsService.updateBasicProductInfo(
        product.id,
        data
      )

      if (error || !success || !updatedProduct) {
        throw error || new Error('Failed to update product')
      }

      // Update local state with the updated product data
      setProduct({ ...product, ...updatedProduct })
      showToast('Product updated successfully', 'success')
      setEditDialogOpen(false)
    } catch (err: any) {
      console.error('Error updating product:', err)
      showToast(`Failed to update product: ${err.message}`, 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const handlePushToErpnext = async () => {
    if (!product?.url) return

    // Validation checks
    const validationErrors: string[] = []

    // Check category and breadcrumbs
    if (!product.category_mapped || product.category_mapped.trim() === '') {
      validationErrors.push('Category is required')
    }
    if (!product.breadcrumbs || (Array.isArray(product.breadcrumbs) && product.breadcrumbs.length === 0)) {
      validationErrors.push('Breadcrumbs are required')
    }

    // Check weight and dimensions
    if (!product.weight_value || product.weight_value === 0) {
      validationErrors.push('Weight is required')
    }
    if (!product.height_value || product.height_value === 0) {
      validationErrors.push('Height is required')
    }
    if (!product.width_value || product.width_value === 0) {
      validationErrors.push('Width is required')
    }
    if (!product.length_value || product.length_value === 0) {
      validationErrors.push('Length is required')
    }

    // If there are validation errors, show them and return
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.length === 1
        ? validationErrors[0]
        : `Missing required data:\n${validationErrors.map(err => `• ${err}`).join('\n')}`

      showToast(errorMessage, 'error')
      return
    }

    setPushing(true)
    console.log('Pushing to ERPNext...', product.url)

    try {
      const { data, error } = await erpnextService.pushProductsByUrls([product.url])

      if (error || !data) {
        throw error || new Error('Failed to push product to ERPNext')
      }

      // Validate response structure
      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
        throw new Error('Invalid response from ERPNext API: missing results')
      }

      const result = data.results[0]

      // Validate result object
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response from ERPNext API: invalid result object')
      }

      if (result.status === 'success') {
        showToast('Product successfully pushed to ERPNext', 'success')
        // Refresh product data to show updated sync status
        window.location.reload()
      } else {
        throw new Error(result.error || 'Failed to push product to ERPNext')
      }
    } catch (err: any) {
      console.error('Error pushing to ERPNext:', err)
      showToast(`Failed to push to ERPNext: ${err.message}`, 'error')
    } finally {
      setPushing(false)
    }
  }

  if (loading) {
    return <ShimmerLoader type="product-detail" />
  }

  if (error || !product) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-600 mb-4">{error || 'Product not found'}</p>
        <button
          onClick={() => navigate('/scraper-agent')}
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
          description={product.description || undefined}
          aiTitle={product.ai_title || undefined}
          aiDescription={product.ai_description || undefined}
          metaTitle={product.meta_title || undefined}
          metaDescription={product.meta_description || undefined}
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
          status={product.category_status || 'pending'}
          categoryMapped={product.category_mapped}
          breadcrumbs={product.breadcrumbs}
          reasoning={product.category_reasoning}
          confidence={product.category_confidence}
          toolsUsed={product.category_tools_used}
          feedback={product.category_feedback}
          updatedAt={product.updated_at}
        />
      ),
    },
    {
      id: 'weight-dimension',
      label: 'Weight & Dimensions',
      icon: <Package className="h-4 w-4" />,
      content: (
        <WeightDimensionTab
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
        />
      ),
    },
    {
      id: 'seo',
      label: 'SEO Optimization',
      icon: <Search className="h-4 w-4" />,
      content: (
        <SeoTab
          status={product.seo_status || 'pending'}
          optimizedTitle={product.optimized_title}
          optimizedDescription={product.optimized_description}
          aiTitle={product.ai_title}
          aiDescription={product.ai_description}
          keywordsUsed={product.keywords_used}
          reasoning={product.seo_reasoning}
          toolsUsed={product.seo_tools_used}
          feedback={product.seo_feedback}
          updatedAt={product.updated_at}
        />
      ),
    },
    {
      id: 'copyright',
      label: 'Copyright Detection',
      icon: <Shield className="h-4 w-4" />,
      content: (
        <CopyrightTab
          status={product.copyright_status || null}
          nonCopyrightImages={product.non_copyright_images}
          nonCopyrightDesc={product.non_copyright_desc}
          confidence={product.copyright_confidence}
          reasoning={product.copyright_reasoning}
          toolsUsed={product.copyright_tools_used}
          feedback={product.copyright_feedback}
          updatedAt={product.updated_at}
        />
      ),
    },
    {
      id: 'variants',
      label: 'Variants',
      icon: <Package2 className="h-4 w-4" />,
      content: (
        <VariantsTab
          variants={product.variants}
          variantCount={product.variant_count}
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
  const copyrightStatus = product.copyright_status || null

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

  // Extract alternative images from the images field
  const extractAlternativeImages = (imagesData: any): string[] => {
    if (!imagesData) return []

    try {
      let images: string[] = []

      // Handle different possible structures
      if (typeof imagesData === 'string') {
        // If it's a JSON string, parse it
        const parsed = JSON.parse(imagesData)
        if (Array.isArray(parsed)) {
          images = parsed.filter((img: any) => typeof img === 'string')
        }
      } else if (Array.isArray(imagesData)) {
        // If it's already an array
        images = imagesData.filter((img: any) => typeof img === 'string')
      } else if (typeof imagesData === 'object') {
        // If it's an object, extract values
        Object.values(imagesData).forEach((value: any) => {
          if (typeof value === 'string') {
            images.push(value)
          } else if (Array.isArray(value)) {
            images.push(...value.filter((img: any) => typeof img === 'string'))
          }
        })
      }

      return images.filter((img) => img && img.trim() !== '')
    } catch (error) {
      console.error('Error parsing images data:', error)
      return []
    }
  }

  const alternativeImages = extractAlternativeImages(product.images)

  // Generate McGrocer URL slug from product name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim()
  }

  const mcgrocerSlug = product.name ? generateSlug(product.name) : undefined

  // Determine navigation source from location state or default to scraper agent
  const fromPage = (location.state as any)?.from || 'scraper-agent'

  const getPageLabel = (page: string) => {
    switch (page) {
      case 'dashboard':
        return 'Dashboard'
      case 'scraper-agent':
        return 'Scraper Agent'
      case 'agents/category':
        return 'Category Agent'
      case 'agents/weight':
        return 'Weight Agent'
      case 'agents/seo':
        return 'SEO Agent'
      case 'agent-monitoring':
        return 'Agent Monitoring'
      default:
        return 'Products'
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm text-gray-600">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
        >
          <Home className="h-4 w-4" />
          <span>Home</span>
        </button>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <button
          onClick={() => navigate(`/${fromPage}`)}
          className="hover:text-blue-600 transition-colors"
        >
          {getPageLabel(fromPage)}
        </button>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <span className="text-gray-900 font-medium truncate max-w-md">
          {product.name || 'Product Details'}
        </span>
      </nav>

      {/* Product Header */}
      <ProductHeader
        name={product.name || 'Unknown Product'}
        code={product.product_id || undefined}
        vendor={product.vendor || undefined}
        price={product.price || undefined}
        originalPrice={product.original_price || undefined}
        imageUrl={product.main_image || undefined}
        alternativeImages={alternativeImages}
        productUrl={product.url || undefined}
        productId={product.id || undefined}
        erpnextUpdatedAt={product.erpnext_updated_at || undefined}
        failedSyncAt={product.failed_sync_at || undefined}
        pinned={product.pinned || false}
        onTogglePin={handleTogglePin}
        togglingPin={togglingPin}
        onEdit={handleEdit}
        onPushToErpnext={handlePushToErpnext}
        pushing={pushing}
        mcgrocerSlug={mcgrocerSlug}
        onComparePrices={() => setPriceCompareOpen(true)}
      />

      {/* Failed Sync Error Banner - Show when there's a failed sync that's more recent than last successful sync */}
      {product.failed_sync_error_message && product.failed_sync_at &&
       (!product.erpnext_updated_at || new Date(product.failed_sync_at) > new Date(product.erpnext_updated_at)) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-800 mb-1">
                ERPNext Sync Failed
              </h3>
              <p className="text-sm text-red-700 whitespace-pre-wrap break-words">
                {product.failed_sync_error_message}
              </p>
              <p className="text-xs text-red-600 mt-2">
                Failed at: {new Date(product.failed_sync_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Agent Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Category Agent */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3 min-h-[60px]">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase mb-2">Category Mapping</p>
              <p className={`text-sm font-semibold ${getStatusColor(categoryStatus)}`}>
                {getStatusText(categoryStatus)}
              </p>
              {product.category_mapped ? (
                <p className="text-xs text-gray-600 mt-1 truncate">{product.category_mapped}</p>
              ) : (
                <p className="text-xs text-gray-600 mt-1 invisible">placeholder</p>
              )}
            </div>
            <Tags className={`h-6 w-6 ${getStatusColor(categoryStatus)}`} />
          </div>
          <div className={categoryStatus === 'pending' || categoryStatus === 'processing' ? 'opacity-50 pointer-events-none' : ''}>
            <RetryButton
              productId={product.id}
              agentType="category"
              agentName="Category Agent"
              onRetry={handleRetry}
              className="w-full justify-center"
            />
          </div>
        </div>

        {/* Weight & Dimension Agent */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3 min-h-[60px]">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase mb-2">Weight & Dimensions</p>
              <p className={`text-sm font-semibold ${getStatusColor(weightStatus)}`}>
                {getStatusText(weightStatus)}
              </p>
              {product.weight_value ? (
                <p className="text-xs text-gray-600 mt-1">
                  {product.weight_value} {product.weight_unit || 'kg'}
                </p>
              ) : (
                <p className="text-xs text-gray-600 mt-1 invisible">placeholder</p>
              )}
            </div>
            <Package className={`h-6 w-6 ${getStatusColor(weightStatus)}`} />
          </div>
          <div className={weightStatus === 'pending' || weightStatus === 'processing' ? 'opacity-50 pointer-events-none' : ''}>
            <RetryButton
              productId={product.id}
              agentType="weight_dimension"
              agentName="Weight & Dimension Agent"
              onRetry={handleRetry}
              className="w-full justify-center"
            />
          </div>
        </div>

        {/* SEO Agent */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3 min-h-[60px]">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase mb-2">SEO Optimization</p>
              <p className={`text-sm font-semibold ${getStatusColor(seoStatus)}`}>
                {getStatusText(seoStatus)}
              </p>
              {product.optimized_title ? (
                <p className="text-xs text-gray-600 mt-1 truncate">{product.optimized_title}</p>
              ) : (
                <p className="text-xs text-gray-600 mt-1 invisible">placeholder</p>
              )}
            </div>
            <Search className={`h-6 w-6 ${getStatusColor(seoStatus)}`} />
          </div>
          <div className={seoStatus === 'pending' || seoStatus === 'processing' ? 'opacity-50 pointer-events-none' : ''}>
            <RetryButton
              productId={product.id}
              agentType="seo"
              agentName="SEO Agent"
              onRetry={handleRetry}
              className="w-full justify-center"
            />
          </div>
        </div>

        {/* Copyright Agent */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3 min-h-[60px]">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase mb-2">Copyright Detection</p>
              <p className={`text-sm font-semibold ${getStatusColor(copyrightStatus || 'pending')}`}>
                {getStatusText(copyrightStatus || 'pending')}
              </p>
              {product.non_copyright_images && product.non_copyright_images.length > 0 ? (
                <p className="text-xs text-gray-600 mt-1">
                  {product.non_copyright_images.length} safe {product.non_copyright_images.length === 1 ? 'image' : 'images'}
                </p>
              ) : (
                <p className="text-xs text-gray-600 mt-1 invisible">placeholder</p>
              )}
            </div>
            <Shield className={`h-6 w-6 ${getStatusColor(copyrightStatus || 'pending')}`} />
          </div>
          <div className={copyrightStatus === 'pending' || copyrightStatus === 'processing' || !copyrightStatus ? 'opacity-50 pointer-events-none' : ''}>
            <RetryButton
              productId={product.id}
              agentType="copyright"
              agentName="Copyright Agent"
              onRetry={handleRetry}
              className="w-full justify-center"
            />
          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <ProductTabs tabs={tabs} />

      {/* Edit Product Dialog */}
      <EditProductDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        product={{
          name: product.name || '',
          price: product.price || 0,
          original_price: product.original_price || 0,
          description: product.description || '',
          stock_status: product.stock_status || 'In Stock',
          main_image: product.main_image || '',
        }}
        onSave={handleSaveEdit}
        saving={savingEdit}
      />

      {/* Price Comparison Dialog */}
      <PriceComparisonDialog
        open={priceCompareOpen}
        onClose={() => setPriceCompareOpen(false)}
        productName={product.name || ''}
      />
    </div>
  )
}
