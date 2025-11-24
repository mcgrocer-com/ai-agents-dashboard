/**
 * ShimmerLoader Component
 *
 * Reusable shimmer loading skeleton for various content types.
 */

interface ShimmerLoaderProps {
  type?: 'card' | 'table' | 'product-detail' | 'agent-page' | 'blog-preview' | 'blog-card'
  rows?: number
}

export function ShimmerLoader({ type = 'card', rows = 5 }: ShimmerLoaderProps) {
  if (type === 'blog-card') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Featured image shimmer */}
        <div className="w-full h-48 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
          bg-[length:200%_100%] animate-shimmer"
        />

        {/* Content shimmer */}
        <div className="p-4 space-y-3">
          <div className="h-5 w-3/4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
            bg-[length:200%_100%] animate-shimmer rounded"
          />
          <div className="h-4 w-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
            bg-[length:200%_100%] animate-shimmer rounded"
          />
          <div className="h-4 w-5/6 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
            bg-[length:200%_100%] animate-shimmer rounded"
          />
          <div className="flex justify-between items-center pt-2">
            <div className="h-3 w-24 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
              bg-[length:200%_100%] animate-shimmer rounded"
            />
            <div className="h-3 w-20 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
              bg-[length:200%_100%] animate-shimmer rounded"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <div className="h-6 w-16 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
              bg-[length:200%_100%] animate-shimmer rounded"
            />
            <div className="h-6 w-16 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
              bg-[length:200%_100%] animate-shimmer rounded"
            />
            <div className="h-6 w-16 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
              bg-[length:200%_100%] animate-shimmer rounded"
            />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'blog-preview') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
        {/* Header shimmer */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 space-y-3">
          <div className="h-8 w-3/4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
            bg-[length:200%_100%] animate-shimmer rounded"
          />
          <div className="flex gap-4">
            <div className="h-4 w-32 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
              bg-[length:200%_100%] animate-shimmer rounded"
            />
            <div className="h-4 w-32 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
              bg-[length:200%_100%] animate-shimmer rounded"
            />
            <div className="h-4 w-32 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
              bg-[length:200%_100%] animate-shimmer rounded"
            />
          </div>
        </div>

        {/* Featured image shimmer */}
        <div className="w-full h-64 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
          bg-[length:200%_100%] animate-shimmer"
        />

        {/* Content shimmer */}
        <div className="px-6 py-8 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
                bg-[length:200%_100%] animate-shimmer rounded"
              style={{ width: `${Math.random() * 20 + 80}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'product-detail') {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex gap-6">
            <div className="w-32 h-32 bg-gray-200 rounded-lg"></div>
            <div className="flex-1 space-y-3">
              <div className="h-8 w-3/4 bg-gray-200 rounded"></div>
              <div className="h-4 w-1/4 bg-gray-200 rounded"></div>
              <div className="h-4 w-1/3 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>

        {/* Status cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="space-y-2">
                <div className="h-3 w-24 bg-gray-200 rounded"></div>
                <div className="h-5 w-20 bg-gray-200 rounded"></div>
                <div className="h-3 w-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs skeleton */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="border-b border-gray-200 p-4">
            <div className="flex gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 w-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="h-4 w-full bg-gray-200 rounded"></div>
            <div className="h-4 w-5/6 bg-gray-200 rounded"></div>
            <div className="h-4 w-4/6 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'agent-page') {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
            <div className="flex-1 space-y-2">
              <div className="h-8 w-64 bg-gray-200 rounded"></div>
              <div className="h-4 w-96 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>

        {/* Metrics skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="space-y-2">
                <div className="h-4 w-20 bg-gray-200 rounded"></div>
                <div className="h-8 w-16 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters skeleton */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex gap-4">
            <div className="h-10 flex-1 bg-gray-200 rounded"></div>
            <div className="h-10 w-32 bg-gray-200 rounded"></div>
            <div className="h-10 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>

        {/* Product cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="space-y-3">
                <div className="w-full h-48 bg-gray-200 rounded"></div>
                <div className="h-5 w-3/4 bg-gray-200 rounded"></div>
                <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
                <div className="flex gap-2">
                  <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                  <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'table') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 animate-pulse">
        <div className="p-6">
          <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-12 w-12 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
                  <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Default card type
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
          <div className="space-y-3">
            <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
            <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
            <div className="h-8 w-full bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

