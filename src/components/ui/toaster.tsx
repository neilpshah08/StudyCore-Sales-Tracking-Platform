"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { useToast } from "@/components/ui/use-toast"
import { Toast, ToastTitle, ToastDescription } from "@/components/ui/toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col-reverse md:max-w-[420px]">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          onClose={() => dismiss(t.id)}
        >
          {t.title && <ToastTitle>{t.title}</ToastTitle>}
          {t.description && (
            <ToastDescription>{t.description}</ToastDescription>
          )}
        </Toast>
      ))}
    </div>,
    document.body
  )
}
