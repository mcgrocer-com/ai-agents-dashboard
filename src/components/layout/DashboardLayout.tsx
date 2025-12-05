/**
 * DashboardLayout Component
 *
 * Main layout for authenticated pages.
 * Includes header, sidebar, and content area.
 */

import { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks'
import {
  LayoutDashboard,
  Package,
  Tag,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  Wrench,
  LogOut,
  ChevronLeft,
  Menu,
  PenTool,
  ShoppingCart,
} from 'lucide-react'

export function DashboardLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { name: 'Home', path: '/dashboard', icon: LayoutDashboard },
    
  ]

  const agentItems = [
    { name: 'Scraper', path: '/scraper-agent', icon: Package },
    { name: 'Category', path: '/agents/category', icon: Tag },
    { name: 'Weight', path: '/agents/weight', icon: Scale },
    { name: 'SEO', path: '/agents/seo', icon: Search },
    { name: 'Copyright', path: '/agents/copyright', icon: Shield },
    { name: 'Classification', path: '/agents/classification', icon: ShieldCheck },
    { name: 'Blogger', path: '/blogger', icon: PenTool },
    { name: 'Shopping Assistant', path: '/shopping-assistant', icon: ShoppingCart },
  ]

  const toolItems = [
    { name: 'Agent Tools', path: '/agent-tools', icon: Wrench },
  ]

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="flex h-screen bg-secondary-50">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-secondary-200 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Toggle */}
          <div className="p-6  border-b border-secondary-200 flex items-center justify-between">
            {!isCollapsed && (
              <h1 className="text-2xl font-bold text-primary-600">
                MCGrocer
              </h1>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`p-2 text-secondary-500 hover:text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors ${
                isCollapsed ? 'mx-auto' : ''
              }`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <Menu className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {/* Main Navigation Items */}
            {navItems.map((item) => {
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-primary-100 text-primary-700 font-semibold'
                      : 'text-secondary-700 hover:bg-primary-50 hover:text-primary-600'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? item.name : ''}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span className="font-medium">{item.name}</span>}
                </Link>
              )
            })}

            {/* Divider */}
            <div className="pt-4 pb-4">
              <div className="border-t border-secondary-200" />
            </div>

            {/* Agents Section */}
            {!isCollapsed && (
              <div className="pb-2">
                <h3 className="px-4 text-xs font-semibold text-secondary-500 uppercase tracking-wider">
                  Agents
                </h3>
              </div>
            )}
            {agentItems.map((item) => {
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-primary-100 text-primary-700 font-semibold'
                      : 'text-secondary-700 hover:bg-primary-50 hover:text-primary-600'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? item.name : ''}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span className="font-medium">{item.name}</span>}
                </Link>
              )
            })}

            {/* Divider */}
            <div className="pt-4 pb-4">
              <div className="border-t border-secondary-200" />
            </div>

            {/* Tools Section */}
            {toolItems.map((item) => {
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-primary-100 text-primary-700 font-semibold'
                      : 'text-secondary-700 hover:bg-primary-50 hover:text-primary-600'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? item.name : ''}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span className="font-medium">{item.name}</span>}
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-secondary-200">
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-600">
                    {user?.email?.[0].toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-secondary-500 hover:text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-600">
                      {user?.email?.[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-900 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-secondary-500 hover:text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="container mx-auto p-6 flex-1 flex flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
