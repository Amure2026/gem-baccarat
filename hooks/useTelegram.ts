'use client'

import { useEffect, useCallback } from 'react'

export function useTelegram() {
  const isTelegram = typeof window !== 'undefined' && 
    typeof (window as any).Telegram !== 'undefined' && 
    typeof (window as any).Telegram.WebApp !== 'undefined'

  const haptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => {
    if (isTelegram && (window as any).Telegram?.WebApp?.HapticFeedback) {
      switch (type) {
        case 'light':
          (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('light')
          break
        case 'medium':
          (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('medium')
          break
        case 'heavy':
          (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('heavy')
          break
        case 'success':
          (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success')
          break
        case 'warning':
          (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('warning')
          break
        case 'error':
          (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('error')
          break
      }
    }
  }, [isTelegram])

  const notification = useCallback((type: 'success' | 'warning' | 'error') => {
    if (isTelegram && (window as any).Telegram?.WebApp?.HapticFeedback) {
      (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred(type)
    }
  }, [isTelegram])

  useEffect(() => {
    if (isTelegram && (window as any).Telegram?.WebApp?.ready) {
      (window as any).Telegram.WebApp.ready()
    }
  }, [isTelegram])

  return { haptic, notification, isTelegram }
}
