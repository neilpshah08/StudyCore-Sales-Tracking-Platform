"use client"

import * as React from "react"

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 5000

export type ToastVariant = "default" | "destructive" | "success"

export type Toast = {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

type ToastState = {
  toasts: Toast[]
}

const listeners: Array<(state: ToastState) => void> = []

let memoryState: ToastState = { toasts: [] }

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

function dispatch(state: ToastState) {
  memoryState = state
  listeners.forEach((listener) => {
    listener(state)
  })
}

function addToast(toast: Omit<Toast, "id">) {
  const id = genId()
  const newToast: Toast = {
    ...toast,
    id,
    duration: toast.duration ?? TOAST_REMOVE_DELAY,
  }

  dispatch({
    toasts: [newToast, ...memoryState.toasts].slice(0, TOAST_LIMIT),
  })

  setTimeout(() => {
    dismissToast(id)
  }, newToast.duration)

  return id
}

function dismissToast(toastId: string) {
  dispatch({
    toasts: memoryState.toasts.filter((t) => t.id !== toastId),
  })
}

function toast(props: Omit<Toast, "id">) {
  return addToast(props)
}

function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: dismissToast,
  }
}

export { useToast, toast }
