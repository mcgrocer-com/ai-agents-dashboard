/**
 * WeightDimensionTab Component
 *
 * Displays weight and dimension agent results with organized sections:
 * 1. Confidence Overview
 * 2. Weight Details & Analysis
 * 3. Dimension Details
 * 4. Tools Usage
 */

import { useState } from 'react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { RetryButton } from '@/components/ui/RetryButton'
import { Model3DViewer, type MeshData } from '@/components/ui/Model3DViewer'
import {
  Wrench,
  AlertCircle,
  Box,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Scale,
  Ruler,
  Package,
  TrendingUp,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'
import DimensionDisplay from '@/components/agents/weight-dimension/DimensionDisplay'

interface WeightDimensionTabProps {
  productId: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  weightValue?: number | null
  weightUnit?: string | null
  contentWeight?: number | null
  packagingWeight?: number | null
  widthValue?: number | null
  heightValue?: number | null
  lengthValue?: number | null
  dimensionUnit?: string | null
  volumetricWeight?: number | null
  materialType?: string | null
  density?: number | null
  structure?: string | null
  itemType?: string | null
  itemCount?: number | null
  containerType?: string | null
  source?: string | null
  internetSources?: any | null
  weightConfidence?: number | null
  weightReasoning?: string | null
  weightToolsUsed?: Record<string, any> | null
  dimensionConfidence?: number | null
  dimensionReasoning?: string | null
  dimensionToolsUsed?: Record<string, any> | null
  processingCost?: number | null
  errorMessage?: string | null
  feedback?: string | null
  glbUrl?: string | null
  updatedAt?: string
  onRetry?: () => void
}

export function WeightDimensionTab({
  productId,
  status,
  weightValue,
  weightUnit,
  contentWeight,
  packagingWeight,
  widthValue,
  heightValue,
  lengthValue,
  dimensionUnit,
  volumetricWeight,
  materialType,
  density,
  structure,
  itemType,
  itemCount,
  containerType,
  source,
  internetSources,
  weightConfidence,
  weightReasoning,
  weightToolsUsed,
  dimensionConfidence,
  dimensionReasoning,
  dimensionToolsUsed,
  errorMessage,
  feedback,
  glbUrl,
  updatedAt,
  onRetry,
}: WeightDimensionTabProps) {
  const [show3DViewer, setShow3DViewer] = useState(false)
  const [meshData, setMeshData] = useState<MeshData | null>(null)

  const handleMeshDataLoaded = (data: MeshData) => {
    setMeshData(data)
  }

  const unit = weightUnit || 'kg'
  const dimUnit = dimensionUnit || 'cm'

  // Helper function to get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-700'
    if (confidence >= 0.6) return 'text-yellow-700'
    return 'text-orange-700'
  }

  const getConfidenceBgColor = (confidence: number) => {
    if (confidence >= 0.8) return 'from-green-500 to-green-600'
    if (confidence >= 0.6) return 'from-yellow-500 to-yellow-600'
    return 'from-orange-500 to-orange-600'
  }

  if (status === 'pending') {
    return (
      <div className="text-center py-12">
        <StatusBadge status={status} />
        <p className="mt-4 text-gray-500">
          Weight & dimension estimation pending
        </p>
      </div>
    )
  }

  if (status === 'failed' && errorMessage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            <RetryButton
              productId={productId}
              agentType="weight_dimension"
              agentName="Weight & Dimension Agent"
              onRetry={onRetry}
            />
          </div>
          {updatedAt && (
            <p className="text-sm text-gray-500">
              Updated: {formatDateTime(updatedAt)}
            </p>
          )}
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Processing Failed</h3>
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          </div>
        </div>
        {feedback && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Retry Feedback</h3>
                <p className="text-sm text-blue-800">{feedback}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {(status === 'complete' || status === 'failed') && (
            <RetryButton
              productId={productId}
              agentType="weight_dimension"
              agentName="Weight & Dimension Agent"
              onRetry={onRetry}
            />
          )}
        </div>
        {updatedAt && (
          <p className="text-sm text-gray-500">
            Updated: {formatDateTime(updatedAt)}
          </p>
        )}
      </div>

      {/* Feedback Display */}
      {feedback && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Retry Feedback</h3>
              <p className="text-sm text-blue-800">{feedback}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========== 1. CONFIDENCE OVERVIEW SECTION ========== */}
      {(weightValue !== null && weightValue !== undefined) ||
       (widthValue !== null && widthValue !== undefined) ||
       (heightValue !== null && heightValue !== undefined) ||
       (lengthValue !== null && lengthValue !== undefined) ? (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-indigo-600" />
            Confidence Overview
          </h2>
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Weight Confidence */}
              {weightValue !== null && weightValue !== undefined && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Scale className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Weight</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {weightValue.toFixed(2)} {unit}
                      </p>
                    </div>
                  </div>
                  {weightConfidence !== null && weightConfidence !== undefined ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Confidence Level</span>
                        <span className={`text-lg font-bold ${getConfidenceColor(weightConfidence)}`}>
                          {(weightConfidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                        <div
                          className={`bg-gradient-to-r ${getConfidenceBgColor(weightConfidence)} h-3 rounded-full transition-all duration-500 shadow-sm`}
                          style={{ width: `${weightConfidence * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Confidence data not available</p>
                  )}
                </div>
              )}

              {/* Dimension Confidence */}
              {(widthValue !== null && widthValue !== undefined) &&
               (heightValue !== null && heightValue !== undefined) &&
               (lengthValue !== null && lengthValue !== undefined) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Ruler className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Dimensions</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {typeof widthValue === 'number' ? widthValue.toFixed(1) : widthValue} × {typeof heightValue === 'number' ? heightValue.toFixed(1) : heightValue} × {typeof lengthValue === 'number' ? lengthValue.toFixed(1) : lengthValue} {dimUnit}
                      </p>
                    </div>
                  </div>
                  {dimensionConfidence !== null && dimensionConfidence !== undefined ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Confidence Level</span>
                        <span className={`text-lg font-bold ${getConfidenceColor(dimensionConfidence)}`}>
                          {(dimensionConfidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                        <div
                          className={`bg-gradient-to-r ${getConfidenceBgColor(dimensionConfidence)} h-3 rounded-full transition-all duration-500 shadow-sm`}
                          style={{ width: `${dimensionConfidence * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Confidence data not available</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ========== 2. WEIGHT DETAILS & ANALYSIS SECTION ========== */}
      {weightValue !== null && weightValue !== undefined && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Scale className="h-6 w-6 text-green-600" />
            Weight Details & Analysis
          </h2>

          {/* Detailed Weight Information */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-5 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total Weight */}
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <p className="text-xs font-medium text-gray-600 mb-1">Total Weight</p>
                <p className="text-xl font-bold text-green-700">{weightValue.toFixed(2)} {unit}</p>
                <p className="text-xs text-gray-500 mt-1">
                  ({(weightValue * 2.20462).toFixed(2)} lbs)
                </p>
              </div>

              {/* Content Weight */}
              {contentWeight !== null && contentWeight !== undefined && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-1">Content Weight</p>
                  <p className="text-xl font-bold text-emerald-700">{contentWeight.toFixed(3)} kg</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {((contentWeight / weightValue) * 100).toFixed(0)}% of total
                  </p>
                </div>
              )}

              {/* Packaging Weight */}
              {packagingWeight !== null && packagingWeight !== undefined && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-1">Packaging Weight</p>
                  <p className="text-xl font-bold text-amber-700">{packagingWeight.toFixed(3)} kg</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {((packagingWeight / weightValue) * 100).toFixed(0)}% of total
                  </p>
                </div>
              )}

              {/* Volumetric Weight */}
              {volumetricWeight !== null && volumetricWeight !== undefined && typeof volumetricWeight === 'number' && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-1">Volumetric Weight</p>
                  <p className="text-xl font-bold text-violet-700">{volumetricWeight.toFixed(2)} kg</p>
                  <p className="text-xs text-gray-500 mt-1">From dimensions</p>
                </div>
              )}

              {/* Material Type */}
              {materialType && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-1">Material Type</p>
                  <p className="text-sm font-semibold text-blue-700 capitalize">{materialType}</p>
                </div>
              )}

              {/* Density */}
              {density !== null && density !== undefined && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-1">Density</p>
                  <p className="text-sm font-semibold text-purple-700">{density.toFixed(2)} g/cm³</p>
                </div>
              )}

              {/* Structure */}
              {structure && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-1">Structure</p>
                  <p className="text-sm font-semibold text-indigo-700 capitalize">{structure}</p>
                </div>
              )}

              {/* Item Type */}
              {itemType && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-1">Item Type</p>
                  <p className="text-sm font-semibold text-rose-700 capitalize">
                    {itemType}
                    {itemCount && itemCount > 1 && ` (${itemCount}×)`}
                  </p>
                </div>
              )}

              {/* Container Type */}
              {containerType && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-1">Container Type</p>
                  <p className="text-sm font-semibold text-teal-700 capitalize">{containerType}</p>
                </div>
              )}

              {/* Source */}
              {source && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-1">Data Source</p>
                  <p className="text-sm font-semibold text-gray-700 capitalize">{source}</p>
                </div>
              )}
            </div>
          </div>

          {/* Weight AI Reasoning */}
          {weightReasoning && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-600" />
                AI Reasoning
              </h3>
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{weightReasoning}</p>
            </div>
          )}
        </div>
      )}

      {/* ========== 3. DIMENSION DETAILS SECTION ========== */}
      {(widthValue || heightValue || lengthValue) && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Ruler className="h-6 w-6 text-blue-600" />
            Dimension Details
          </h2>

          {/* Detailed Dimension Information */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-5 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Information</h3>

            {/* Combined Display */}
            <div className="mb-4">
              <DimensionDisplay
                width={widthValue ?? 0}
                height={heightValue ?? 0}
                depth={lengthValue ?? 0}
              />
            </div>

            {/* Individual Dimension Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {widthValue !== null && widthValue !== undefined && (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-700 mb-2">Width</p>
                  <p className="text-3xl font-bold text-sky-700">
                    {typeof widthValue === 'number' ? widthValue.toFixed(1) : widthValue}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{dimUnit}</p>
                </div>
              )}

              {heightValue !== null && heightValue !== undefined && (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-700 mb-2">Height</p>
                  <p className="text-3xl font-bold text-indigo-700">
                    {typeof heightValue === 'number' ? heightValue.toFixed(1) : heightValue}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{dimUnit}</p>
                </div>
              )}

              {lengthValue !== null && lengthValue !== undefined && (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-700 mb-2">Length/Depth</p>
                  <p className="text-3xl font-bold text-cyan-700">
                    {typeof lengthValue === 'number' ? lengthValue.toFixed(1) : lengthValue}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{dimUnit}</p>
                </div>
              )}
            </div>
          </div>

          {/* Dimension AI Reasoning */}
          {dimensionReasoning && (
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-cyan-600" />
                AI Reasoning
              </h3>
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{dimensionReasoning}</p>
            </div>
          )}
        </div>
      )}

      {/* ========== 3D MODEL SECTION (STANDALONE) ========== */}
      {glbUrl && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Box className="h-6 w-6 text-indigo-600" />
            3D Model
          </h2>
          <div className="bg-white border border-indigo-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-4">
              Interactive 3D model generated for dimension estimation
            </p>

            {!show3DViewer ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShow3DViewer(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  View 3D Model
                </button>
                <a
                  href={glbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Download GLB File
                </a>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setShow3DViewer(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <EyeOff className="h-4 w-4" />
                    Hide 3D Model
                  </button>
                  <a
                    href={glbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Download GLB File
                  </a>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* 3D Viewer */}
                  <div className="lg:col-span-2">
                    <Model3DViewer
                      glbUrl={glbUrl}
                      className="h-[500px] w-full"
                      onMeshDataLoaded={handleMeshDataLoaded}
                    />
                  </div>

                  {/* Mesh Data */}
                  <div className="bg-gradient-to-br from-slate-50 to-gray-100 border border-gray-300 rounded-lg p-4 overflow-y-auto max-h-[500px]">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Box className="h-4 w-4 text-indigo-600" />
                      3D Mesh Data
                    </h4>
                    <div className="space-y-3 text-sm">
                      {meshData ? (
                        <>
                          {/* Mesh Geometry */}
                          <div className="flex justify-between items-center pb-2 border-b border-gray-300">
                            <span className="text-gray-600 font-medium">Mesh Geometry</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Vertices:</span>
                            <span className="font-semibold text-gray-900">{meshData.vertices.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Faces:</span>
                            <span className="font-semibold text-gray-900">{meshData.faces.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Triangles:</span>
                            <span className="font-semibold text-gray-900">{meshData.triangles.toLocaleString()}</span>
                          </div>

                          {/* Bounding Box */}
                          <div className="flex justify-between items-center pt-2 pb-2 border-b border-t border-gray-300">
                            <span className="text-gray-600 font-medium">Model Bounds</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Width:</span>
                            <span className="font-semibold text-gray-900">{meshData.boundingBox.width.toFixed(3)} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Height:</span>
                            <span className="font-semibold text-gray-900">{meshData.boundingBox.height.toFixed(3)} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Depth:</span>
                            <span className="font-semibold text-gray-900">{meshData.boundingBox.depth.toFixed(3)} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Volume:</span>
                            <span className="font-semibold text-gray-900">{meshData.volume.toFixed(3)} units³</span>
                          </div>

                          {/* Surface Area */}
                          <div className="flex justify-between items-center pt-2 pb-2 border-b border-t border-gray-300">
                            <span className="text-gray-600 font-medium">Surface Data</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Surface Area:</span>
                            <span className="font-semibold text-gray-900">{meshData.surfaceArea.toFixed(2)} units²</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Watertight:</span>
                            <span className={`font-semibold ${meshData.isWatertight ? 'text-green-700' : 'text-amber-700'}`}>
                              {meshData.isWatertight ? 'Yes' : 'No'}
                            </span>
                          </div>

                          {/* Model Info */}
                          <div className="flex justify-between items-center pt-2 pb-2 border-b border-t border-gray-300">
                            <span className="text-gray-600 font-medium">Model Info</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Format:</span>
                            <span className="font-semibold text-gray-900">GLB</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Source:</span>
                            <span className="font-semibold text-gray-900 text-xs">{source || 'AI Generated'}</span>
                          </div>

                          <div className="pt-3 mt-3 border-t border-gray-300">
                            <p className="text-xs text-gray-500 italic">
                              Note: Model units are normalized and scaled to real-world dimensions ({widthValue && heightValue && lengthValue ? `${typeof widthValue === 'number' ? widthValue.toFixed(1) : widthValue} × ${typeof heightValue === 'number' ? heightValue.toFixed(1) : heightValue} × ${typeof lengthValue === 'number' ? lengthValue.toFixed(1) : lengthValue} cm` : 'N/A'})
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <Loader2 className="h-6 w-6 text-gray-400 animate-spin mx-auto mb-2" />
                          <p className="text-xs text-gray-500">Loading mesh data...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Internet Sources */}
      {internetSources && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-blue-600" />
            Internet Sources
          </h3>
          {(() => {
            // Parse internet sources to extract URLs
            let sources = []
            try {
              if (typeof internetSources === 'string') {
                try {
                  const parsed = JSON.parse(internetSources)
                  if (Array.isArray(parsed)) {
                    sources = parsed
                  } else if (typeof parsed === 'object') {
                    sources = Object.values(parsed).flat()
                  }
                } catch {
                  const urlRegex = /(https?:\/\/[^\s]+)/g
                  sources = internetSources.match(urlRegex) || []
                }
              } else if (Array.isArray(internetSources)) {
                sources = internetSources
              } else if (typeof internetSources === 'object') {
                sources = Object.values(internetSources).flat()
              }
            } catch (e) {
              console.error('Error parsing internet sources:', e)
            }

            if (sources.length > 0) {
              return (
                <div className="space-y-2">
                  {sources.map((url, idx) => {
                    const urlStr = typeof url === 'string' ? url : url?.url || String(url)
                    const isValidUrl = urlStr.startsWith('http://') || urlStr.startsWith('https://')

                    return (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-blue-600 font-semibold text-sm mt-1">{idx + 1}.</span>
                        {isValidUrl ? (
                          <a
                            href={urlStr}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline text-sm break-all flex items-center gap-1"
                          >
                            {urlStr}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-gray-700 text-sm break-all">{urlStr}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }

            return (
              <pre className="text-xs text-gray-800 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
                {typeof internetSources === 'string'
                  ? internetSources
                  : JSON.stringify(internetSources, null, 2)}
              </pre>
            )
          })()}
        </div>
      )}

      {/* ========== 4. TOOLS USAGE SECTION ========== */}
      {(weightToolsUsed && Object.keys(weightToolsUsed).length > 0) ||
        (dimensionToolsUsed && Object.keys(dimensionToolsUsed).length > 0) ? (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="h-6 w-6 text-teal-600" />
            Tools Usage
          </h2>

          <div className="space-y-4">
            {/* Weight Tools Used */}
            {weightToolsUsed && Object.keys(weightToolsUsed).length > 0 && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-purple-600" />
                  Weight Tools Used
                </h3>
                <pre className="text-sm text-gray-900 whitespace-pre-wrap overflow-x-auto bg-white rounded p-3 max-h-64 overflow-y-auto">
                  {JSON.stringify(weightToolsUsed, null, 2)}
                </pre>
              </div>
            )}

            {/* Dimension Tools Used */}
            {dimensionToolsUsed && Object.keys(dimensionToolsUsed).length > 0 && (
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-cyan-600" />
                  Dimension Tools Used
                </h3>
                <pre className="text-sm text-gray-900 whitespace-pre-wrap overflow-x-auto bg-white rounded p-3 max-h-64 overflow-y-auto">
                  {JSON.stringify(dimensionToolsUsed, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
