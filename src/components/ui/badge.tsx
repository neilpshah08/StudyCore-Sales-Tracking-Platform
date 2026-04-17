"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[#3B82F6]/30 bg-[#3B82F6]/15 text-[#93C5FD]",
        secondary:
          "border-white/10 bg-white/8 text-white/80",
        destructive:
          "border-[#EF4444]/30 bg-[#EF4444]/15 text-[#FCA5A5]",
        outline:
          "border-white/15 text-white/80",
        success:
          "border-[#10B981]/30 bg-[#10B981]/15 text-[#6EE7B7]",
        warning:
          "border-[#F59E0B]/30 bg-[#F59E0B]/15 text-[#FCD34D]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
