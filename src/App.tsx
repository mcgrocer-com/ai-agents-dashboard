/**
 * App Component
 *
 * Main application component with routing.
 * Handles authentication flow and route protection.
 */

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Toast } from '@/components/ui/Toast'
import { useToast } from '@/hooks/useToast'
import {
  LoginPage,
  DashboardPage,
  ScraperAgentPage,
  ProductDetailPage,
  AgentsPage,
  CategoryAgentPage,
  WeightAgentPage,
  SeoAgentPage,
  AgentToolsPage,
  AdminPage,
} from '@/pages'

function App() {
  const { message, type, hideToast } = useToast()

  return (
    <HashRouter>
      {message && <Toast message={message} type={type} onClose={hideToast} />}
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes with dashboard layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/scraper-agent" element={<ScraperAgentPage />} />
            <Route path="/scraper-agent/:id" element={<ProductDetailPage />} />
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
    </HashRouter>
  )
}

export default App
