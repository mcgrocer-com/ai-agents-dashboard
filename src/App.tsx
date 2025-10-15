/**
 * App Component
 *
 * Main application component with routing.
 * Handles authentication flow and route protection.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  LoginPage,
  DashboardPage,
  ProductsPage,
  ProductDetailPage,
  AgentsPage,
  CategoryAgentPage,
  WeightAgentPage,
  SeoAgentPage,
  AgentToolsPage,
  AdminPage,
} from '@/pages'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes with dashboard layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/category" element={<CategoryAgentPage />} />
            <Route path="/agents/weight" element={<WeightAgentPage />} />
            <Route path="/agents/seo" element={<SeoAgentPage />} />
            <Route path="/agent-tools" element={<AgentToolsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 404 - Not found */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
