/**
 * JobQueueManager Component
 *
 * Manages job queue entries with CRUD operations and reordering.
 * Opens in a dialog, shows running tasks at top, allows reordering pending tasks.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ListTodo,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Toast } from '@/components/ui/Toast'
import { formatNumber } from '@/lib/utils/format'
import { productsService } from '@/services'

interface JobQueue {
  id: string
  vendor: string | null
  agent_types: string[]
  batch_size: number
  max_batches: number | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  created_at: string
  started_at: string | null
  completed_at: string | null
  products_processed: number
  products_successful: number
  products_failed: number
  error_message: string | null
  server_id: string | null
}

interface JobFormData {
  vendor: string
  agent_types: string[]
  batch_size: number
  max_batches: number | null
}

const AGENT_OPTIONS = [
  { value: 'category', label: 'Category Mapper' },
  { value: 'weight-dimension', label: 'Weight & Dimension' },
  { value: 'seo', label: 'SEO Optimizer' },
]

const AGENT_LABELS: Record<string, string> = {
  category: 'category',
  weight_dimension: 'weight and dimension',
  seo: 'SEO',
}

const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  running: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Play },
  completed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  failed: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
}

export function JobQueueManager() {
  const [jobs, setJobs] = useState<JobQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [showMainDialog, setShowMainDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingJob, setEditingJob] = useState<JobQueue | null>(null)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  // Fetch jobs and sort them (running tasks first, then by created_at)
  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('job_queue')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error

      // Sort: running tasks first, then pending/completed/failed by created_at
      const sortedJobs = (data || []).sort((a, b) => {
        if (a.status === 'running' && b.status !== 'running') return -1
        if (a.status !== 'running' && b.status === 'running') return 1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      setJobs(sortedJobs)
    } catch (error) {
      console.error('Error fetching jobs:', error)
      setToast({ message: 'Failed to fetch jobs', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()

    // Subscribe to realtime updates
    const subscription = supabase
      .channel('job_queue_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_queue' },
        () => {
          fetchJobs()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Add job
  const handleAddJob = async (formData: JobFormData) => {
    try {
      const { error } = await supabase.from('job_queue').insert({
        vendor: formData.vendor || null,
        agent_types: formData.agent_types,
        batch_size: formData.batch_size,
        max_batches: formData.max_batches,
        status: 'pending',
        products_processed: 0,
        products_successful: 0,
        products_failed: 0,
      })

      if (error) throw error
      setToast({ message: 'Job added successfully', type: 'success' })
      setShowAddDialog(false)
      fetchJobs()
    } catch (error) {
      console.error('Error adding job:', error)
      setToast({ message: 'Failed to add job', type: 'error' })
    }
  }

  // Update job
  const handleUpdateJob = async (formData: JobFormData) => {
    if (!editingJob) return

    try {
      const { error } = await supabase
        .from('job_queue')
        .update({
          vendor: formData.vendor || null,
          agent_types: formData.agent_types,
          batch_size: formData.batch_size,
          max_batches: formData.max_batches,
        })
        .eq('id', editingJob.id)

      if (error) throw error
      setToast({ message: 'Job updated successfully', type: 'success' })
      setShowEditDialog(false)
      setEditingJob(null)
      fetchJobs()
    } catch (error) {
      console.error('Error updating job:', error)
      setToast({ message: 'Failed to update job', type: 'error' })
    }
  }

  // Delete job
  const handleDeleteJob = async (id: string) => {
    try {
      const { error } = await supabase.from('job_queue').delete().eq('id', id)

      if (error) throw error
      setToast({ message: 'Job deleted successfully', type: 'success' })
      await fetchJobs()
    } catch (error) {
      console.error('Error deleting job:', error)
      setToast({ message: 'Failed to delete job', type: 'error' })
    }
  }


  // Get running and reorderable (non-running) jobs
  const runningJobs = jobs.filter((j) => j.status === 'running')
  const reorderableJobs = jobs.filter((j) => j.status !== 'running')

  return (
    <>
      {/* Manage Tasks Button */}
      <button
        onClick={() => setShowMainDialog(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        <ListTodo className="h-4 w-4" />
        Manage Tasks
      </button>

      {/* Main Job Queue Dialog */}
      {showMainDialog && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowMainDialog(false)}
            aria-hidden="true"
          />

          {/* Dialog Container */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {/* Custom Header with Add Job Button */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Job Queue Manager</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddDialog(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add Job
                  </button>
                  <button
                    onClick={() => setShowMainDialog(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    aria-label="Close dialog"
                  >
                    <span className="text-2xl leading-none">&times;</span>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">

            {/* Jobs List */}
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-100 rounded-lg" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-600">No jobs in queue</p>
                <p className="text-xs text-gray-500 mt-1">
                  Click "Add Job" to create a new job
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {/* Running Tasks Section */}
                {runningJobs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Play className="h-4 w-4 text-blue-600" />
                      Running Tasks
                    </h3>
                    <div className="space-y-2">
                      {runningJobs.map((job) => (
                        <JobItem
                          key={job.id}
                          job={job}
                          onEdit={() => {
                            setEditingJob(job)
                            setShowEditDialog(true)
                          }}
                          onDelete={() => handleDeleteJob(job.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending/Other Tasks Section */}
                {reorderableJobs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      Pending Tasks
                    </h3>
                    <div className="space-y-2">
                      {reorderableJobs.map((job) => (
                        <JobItem
                          key={job.id}
                          job={job}
                          onEdit={() => {
                            setEditingJob(job)
                            setShowEditDialog(true)
                          }}
                          onDelete={() => handleDeleteJob(job.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Job Dialog */}
      {showAddDialog && (
        <JobFormDialog
          title="Add Job"
          onSubmit={handleAddJob}
          onClose={() => setShowAddDialog(false)}
        />
      )}

      {/* Edit Job Dialog */}
      {showEditDialog && editingJob && (
        <JobFormDialog
          title="Edit Job"
          initialData={{
            vendor: editingJob.vendor || '',
            agent_types: editingJob.agent_types,
            batch_size: editingJob.batch_size,
            max_batches: editingJob.max_batches,
          }}
          onSubmit={handleUpdateJob}
          onClose={() => {
            setShowEditDialog(false)
            setEditingJob(null)
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}

interface JobItemProps {
  job: JobQueue
  onEdit: () => void
  onDelete: () => void
}

function JobItem({
  job,
  onEdit,
  onDelete,
}: JobItemProps) {
  const statusConfig = STATUS_COLORS[job.status]
  const StatusIcon = statusConfig.icon

  return (
    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">

      {/* Job info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">
            {job.vendor || 'All Vendors'}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
          >
            <StatusIcon className="h-3 w-3" />
            {job.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>Agents: {job.agent_types.join(', ')}</span>
          <span>•</span>
          <span>Batch: {job.batch_size}</span>
          {job.max_batches && (
            <>
              <span>•</span>
              <span>Max: {job.max_batches}</span>
            </>
          )}
        </div>
        {job.products_processed > 0 && (
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="text-gray-600">
              Processed: {formatNumber(job.products_processed)}
            </span>
            <span className="text-green-600">
              ✓ {formatNumber(job.products_successful)}
            </span>
            {job.products_failed > 0 && (
              <span className="text-red-600">
                ✗ {formatNumber(job.products_failed)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          disabled={job.status === 'running'}
          className="p-2 hover:bg-blue-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Edit job"
        >
          <Pencil className="h-4 w-4 text-blue-600" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          disabled={job.status === 'running'}
          className="p-2 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Delete job"
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </button>
      </div>
    </div>
  )
}

interface JobFormDialogProps {
  title: string
  initialData?: JobFormData
  onSubmit: (data: JobFormData) => void
  onClose: () => void
}

function JobFormDialog({
  title,
  initialData,
  onSubmit,
  onClose,
}: JobFormDialogProps) {
  const [formData, setFormData] = useState<JobFormData>(
    initialData || {
      vendor: '',
      agent_types: [],
      batch_size: 10,
      max_batches: null,
    }
  )
  const [vendors, setVendors] = useState<{ name: string; count: number }[]>([])
  const [loadingVendors, setLoadingVendors] = useState(true)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Load vendors on mount
  useEffect(() => {
    const loadVendors = async () => {
      const { vendors: vendorList } = await productsService.getVendors()
      if (vendorList) {
        setVendors(vendorList)
      }
      setLoadingVendors(false)
    }
    loadVendors()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.agent_types.length === 0) {
      setValidationError('Please select at least one agent type')
      return
    }
    setValidationError(null)
    onSubmit(formData)
  }

  // Generate job summary
  const generateSummary = () => {
    if (formData.agent_types.length === 0) {
      return 'Select agent types to see job summary'
    }

    const agentNames = formData.agent_types
      .map((type) => AGENT_LABELS[type])
      .join(' and ')

    const vendorText = formData.vendor
      ? `from ${formData.vendor}`
      : 'from all vendors'

    const batchText = formData.max_batches
      ? `up to ${formData.max_batches * formData.batch_size} products`
      : 'all available products'

    return `Deploy ${agentNames} agent${formData.agent_types.length > 1 ? 's' : ''} to process ${batchText} ${vendorText}`
  }

  return (
    <Dialog open={true} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vendor
          </label>
          {loadingVendors ? (
            <div className="w-full h-10 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <select
              value={formData.vendor}
              onChange={(e) =>
                setFormData({ ...formData, vendor: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.name} value={vendor.name}>
                  {vendor.name} ({vendor.count.toLocaleString()} products)
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agent Types *
          </label>
          {validationError && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{validationError}</p>
            </div>
          )}
          <div className="space-y-2">
            {AGENT_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.agent_types.includes(option.value)}
                  onChange={(e) => {
                    setValidationError(null) // Clear error when user selects
                    if (e.target.checked) {
                      setFormData({
                        ...formData,
                        agent_types: [...formData.agent_types, option.value],
                      })
                    } else {
                      setFormData({
                        ...formData,
                        agent_types: formData.agent_types.filter(
                          (t) => t !== option.value
                        ),
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Batch Size *
          </label>
          <input
            type="number"
            value={formData.batch_size}
            onChange={(e) =>
              setFormData({
                ...formData,
                batch_size: parseInt(e.target.value) || 1,
              })
            }
            min="1"
            max="100"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Number of products per batch (1-100)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Batches (optional)
          </label>
          <input
            type="number"
            value={formData.max_batches || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                max_batches: e.target.value ? parseInt(e.target.value) : null,
              })
            }
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Leave empty for unlimited"
          />
        </div>

        {/* Job Summary Footer */}
        <div className="border-t border-gray-200 pt-4 mt-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Job Summary:</p>
          <p className="text-sm text-gray-600 italic bg-blue-50 p-3 rounded-lg border border-blue-100">
            {generateSummary()}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {initialData ? 'Update' : 'Add'} Job
          </button>
        </div>
      </form>
    </Dialog>
  )
}
