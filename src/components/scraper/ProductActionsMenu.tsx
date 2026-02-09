/**
 * ProductActionsMenu Component
 *
 * Dropdown menu for individual product actions like resync to ERPNext
 * and send to Copyright Agent.
 */

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, RefreshCw, RotateCcw, Ban } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/useToast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { blacklistService } from '@/services'

interface ProductActionsMenuProps {
  productId: string
  productName: string
  isBlacklisted?: boolean
  onBlacklistChange?: () => void
  onActionComplete?: () => void
}

export function ProductActionsMenu({ productId, productName, isBlacklisted, onBlacklistChange, onActionComplete }: ProductActionsMenuProps) {
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [showResyncConfirm, setShowResyncConfirm] = useState(false)
  const [showCopyrightConfirm, setShowCopyrightConfirm] = useState(false)
  const [showBlacklistConfirm, setShowBlacklistConfirm] = useState(false)
  const [isResyncing, setIsResyncing] = useState(false)
  const [isSendingToCopyright, setIsSendingToCopyright] = useState(false)
  const [isBlacklisting, setIsBlacklisting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleResyncToErpNext = async () => {
    setIsResyncing(true)
    try {
      const { data, error } = await supabase.functions.invoke('resync-product-to-erpnext', {
        body: { productId }
      })

      if (error) throw error

      if (data.success) {
        showToast(`Product "${productName}" successfully reset for ERPNext resync`, 'success')
        onActionComplete?.()
      } else {
        showToast(data.error || 'Failed to reset product for ERPNext resync', 'error')
      }
    } catch (err) {
      console.error('Error resyncing product to ERPNext:', err)
      showToast('An error occurred while resyncing product to ERPNext', 'error')
    } finally {
      setIsResyncing(false)
      setShowResyncConfirm(false)
      setIsOpen(false)
    }
  }

  const handleSendToCopyright = async () => {
    setIsSendingToCopyright(true)
    try {
      const { data, error } = await supabase.functions.invoke('add-product-copyright', {
        body: { productId }
      })

      if (error) throw error

      if (data.success) {
        showToast(`Product "${productName}" successfully sent to Copyright Agent`, 'success')
        onActionComplete?.()
      } else {
        showToast(data.error || 'Failed to send product to Copyright Agent', 'error')
      }
    } catch (err) {
      console.error('Error sending product to Copyright Agent:', err)
      showToast('An error occurred while sending product to Copyright Agent', 'error')
    } finally {
      setIsSendingToCopyright(false)
      setShowCopyrightConfirm(false)
      setIsOpen(false)
    }
  }

  const handleBlacklistAction = async () => {
    if (isBlacklisted) {
      // Remove from blacklist
      setIsBlacklisting(true)
      try {
        const result = await blacklistService.unblacklistProduct(productId)

        if (result.success) {
          showToast(`Product "${productName}" removed from blacklist`, 'success')
          onBlacklistChange?.()
          onActionComplete?.()
        } else {
          showToast(result.error?.message || 'Failed to remove product from blacklist', 'error')
        }
      } catch (err) {
        console.error('Error removing product from blacklist:', err)
        showToast('An error occurred while removing product from blacklist', 'error')
      } finally {
        setIsBlacklisting(false)
        setShowBlacklistConfirm(false)
        setIsOpen(false)
      }
    } else {
      // Add to blacklist - prompt for reason
      const reason = window.prompt('Please enter a reason for blacklisting this product:')
      if (reason === null || reason.trim() === '') {
        // User cancelled or entered empty reason
        setShowBlacklistConfirm(false)
        setIsOpen(false)
        return
      }

      setIsBlacklisting(true)
      try {
        const result = await blacklistService.blacklistProduct(productId, reason)

        if (result.success) {
          showToast(`Product "${productName}" successfully blacklisted`, 'success')
          onBlacklistChange?.()
          onActionComplete?.()
        } else {
          showToast(result.error?.message || 'Failed to blacklist product', 'error')
        }
      } catch (err) {
        console.error('Error blacklisting product:', err)
        showToast('An error occurred while blacklisting product', 'error')
      } finally {
        setIsBlacklisting(false)
        setShowBlacklistConfirm(false)
        setIsOpen(false)
      }
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Hamburger Menu Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Product actions"
      >
        <MoreVertical className="w-5 h-5 text-gray-600" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false)
                setShowResyncConfirm(true)
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-indigo-600" />
              <span>Resync to ERPNext</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false)
                setShowCopyrightConfirm(true)
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-orange-600" />
              <span>Send to Copyright Agent</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false)
                setShowBlacklistConfirm(true)
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
            >
              <Ban className="w-4 h-4 text-red-600" />
              <span>{isBlacklisted ? 'Remove from Blacklist' : 'Blacklist Product'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Resync to ERPNext Confirmation Dialog */}
      <ConfirmationDialog
        open={showResyncConfirm}
        onClose={() => setShowResyncConfirm(false)}
        onConfirm={handleResyncToErpNext}
        title="Resync to ERPNext"
        message={`Are you sure you want to resync "${productName}" to ERPNext?\n\nThis will reset its sync status and force it to be re-synced in the next sync cycle.`}
        confirmText="Resync"
        cancelText="Cancel"
        variant="info"
        loading={isResyncing}
      />

      {/* Copyright Confirmation Dialog */}
      <ConfirmationDialog
        open={showCopyrightConfirm}
        onClose={() => setShowCopyrightConfirm(false)}
        onConfirm={handleSendToCopyright}
        title="Send to Copyright Agent"
        message={`Are you sure you want to send "${productName}" to the Copyright Agent?\n\nThis will reset its copyright status to pending and queue it for processing.`}
        confirmText="Send to Agent"
        cancelText="Cancel"
        variant="warning"
        loading={isSendingToCopyright}
      />

      {/* Blacklist Confirmation Dialog */}
      <ConfirmationDialog
        open={showBlacklistConfirm}
        onClose={() => setShowBlacklistConfirm(false)}
        onConfirm={handleBlacklistAction}
        title={isBlacklisted ? 'Remove from Blacklist' : 'Blacklist Product'}
        message={
          isBlacklisted
            ? `Are you sure you want to remove "${productName}" from the blacklist?\n\nThis will allow the product to be synced to ERPNext again.`
            : `Are you sure you want to blacklist "${productName}"?\n\nYou will be prompted to enter a reason. This will prevent the product from being synced to ERPNext.`
        }
        confirmText={isBlacklisted ? 'Remove from Blacklist' : 'Blacklist'}
        cancelText="Cancel"
        variant={isBlacklisted ? 'warning' : 'danger'}
        loading={isBlacklisting}
      />
    </div>
  )
}
