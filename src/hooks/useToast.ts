import { create } from 'zustand'

interface ToastState {
  message: string | null
  type: 'success' | 'error' | 'info'
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  hideToast: () => void
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  type: 'info',
  showToast: (message, type = 'info') => set({ message, type }),
  hideToast: () => set({ message: null }),
}))
