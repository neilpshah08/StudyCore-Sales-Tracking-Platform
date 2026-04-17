"use client"

import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass-skeleton h-4 w-full", className)}
      {...props}
    />
  )
}

export { Skeleton }
