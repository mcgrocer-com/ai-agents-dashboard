/**
 * Model3DViewer Component
 *
 * Embedded 3D model viewer for GLB files using Three.js.
 * Provides interactive controls for rotating, zooming, and inspecting 3D models.
 */

import { Suspense, useState, useEffect, Component, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Center } from '@react-three/drei'
import { Loader2, AlertCircle } from 'lucide-react'
import * as THREE from 'three'

// Error Boundary for catching Three.js errors
class ErrorBoundary extends Component<
  { children: ReactNode; onError: (error: Error) => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: (error: Error) => void }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}

interface ModelProps {
  url: string
  onMeshDataLoaded?: (meshData: MeshData) => void
}

export interface MeshData {
  vertices: number
  faces: number
  triangles: number
  boundingBox: {
    width: number
    height: number
    depth: number
  }
  volume: number
  surfaceArea: number
  isWatertight: boolean
}

function Model({ url, onMeshDataLoaded }: ModelProps) {
  const gltf = useGLTF(url, false, true, (loader) => {
    // Configure loader to not use workers
    loader.setWithCredentials(false)
  })
  const scene = gltf.scene

  useEffect(() => {
    if (scene && onMeshDataLoaded) {
      // Calculate mesh data from loaded scene
      let totalVertices = 0
      let totalFaces = 0
      let totalTriangles = 0
      let totalVolume = 0
      let totalSurfaceArea = 0
      const boundingBox = new THREE.Box3()

      scene.traverse((child: any) => {
        if (child.isMesh && child.geometry) {
          const geometry = child.geometry

          // Count vertices
          if (geometry.attributes.position) {
            totalVertices += geometry.attributes.position.count
          }

          // Count faces/triangles
          if (geometry.index) {
            totalTriangles += geometry.index.count / 3
            totalFaces += geometry.index.count / 3
          } else if (geometry.attributes.position) {
            totalTriangles += geometry.attributes.position.count / 3
            totalFaces += geometry.attributes.position.count / 3
          }

          // Update bounding box
          geometry.computeBoundingBox()
          if (geometry.boundingBox) {
            boundingBox.union(geometry.boundingBox)
          }

          // Calculate surface area (approximate)
          if (geometry.attributes.position && geometry.index) {
            const positions = geometry.attributes.position.array
            const indices = geometry.index.array

            for (let i = 0; i < indices.length; i += 3) {
              const v0 = new THREE.Vector3(
                positions[indices[i] * 3],
                positions[indices[i] * 3 + 1],
                positions[indices[i] * 3 + 2]
              )
              const v1 = new THREE.Vector3(
                positions[indices[i + 1] * 3],
                positions[indices[i + 1] * 3 + 1],
                positions[indices[i + 1] * 3 + 2]
              )
              const v2 = new THREE.Vector3(
                positions[indices[i + 2] * 3],
                positions[indices[i + 2] * 3 + 1],
                positions[indices[i + 2] * 3 + 2]
              )

              const edge1 = v1.clone().sub(v0)
              const edge2 = v2.clone().sub(v0)
              const triangleArea = edge1.cross(edge2).length() / 2
              totalSurfaceArea += triangleArea
            }
          }
        }
      })

      const size = boundingBox.getSize(new THREE.Vector3())
      totalVolume = size.x * size.y * size.z

      const meshData: MeshData = {
        vertices: totalVertices,
        faces: Math.round(totalFaces),
        triangles: Math.round(totalTriangles),
        boundingBox: {
          width: size.x,
          height: size.y,
          depth: size.z,
        },
        volume: totalVolume,
        surfaceArea: totalSurfaceArea,
        isWatertight: totalFaces > 0, // Simplified check
      }

      onMeshDataLoaded(meshData)
    }
  }, [scene, onMeshDataLoaded])

  return (
    <Center>
      <primitive object={scene} scale={1} />
    </Center>
  )
}

interface Model3DViewerProps {
  glbUrl: string
  className?: string
  onMeshDataLoaded?: (meshData: MeshData) => void
}

export function Model3DViewer({ glbUrl, className = '', onMeshDataLoaded }: Model3DViewerProps) {
  const [error, setError] = useState<string | null>(null)

  const handleError = (err?: any) => {
    console.error('3D Model loading error:', err)
    setError('Failed to load 3D model. This may be due to CORS restrictions or the file being unavailable.')
  }

  useEffect(() => {
    // Reset states when URL changes
    setError(null)
  }, [glbUrl])

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 mb-1">3D Model Error</h3>
            <p className="text-sm text-red-800 mb-3">{error}</p>
            <p className="text-xs text-red-700">
              Note: If you're seeing CORS errors, the Supabase storage bucket may need CORS configuration.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg overflow-hidden ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance'
        }}
        dpr={[1, 2]}
        style={{ height: '100%', width: '100%' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />
          <ErrorBoundary onError={handleError}>
            <Center>
              <Model url={glbUrl} onMeshDataLoaded={onMeshDataLoaded} />
            </Center>
          </ErrorBoundary>
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={2}
            maxDistance={10}
          />
        </Suspense>
      </Canvas>

      {/* Loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Suspense fallback={
          <div className="bg-white/90 rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-gray-700">Loading 3D model...</p>
            </div>
          </div>
        }>
          <></>
        </Suspense>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs rounded px-3 py-2 pointer-events-none">
        <p className="font-medium mb-1">Controls:</p>
        <p>• Left click + drag to rotate</p>
        <p>• Right click + drag to pan</p>
        <p>• Scroll to zoom</p>
      </div>
    </div>
  )
}

// Preload GLB models for better performance
useGLTF.preload = (url: string) => useGLTF(url)
