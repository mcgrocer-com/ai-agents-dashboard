/**
 * AdminPage Component
 *
 * Admin settings and configuration.
 */

export function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">Admin</h1>
        <p className="text-secondary-600 mt-2">
          System settings and configuration
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-secondary-200">
        <h2 className="text-xl font-bold text-secondary-900 mb-4">
          System Settings
        </h2>
        <p className="text-secondary-600">Admin controls will appear here</p>
      </div>
    </div>
  )
}
