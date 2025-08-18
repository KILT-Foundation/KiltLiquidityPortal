import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 backdrop-blur-[12px]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-soft-modern hover:from-pink-400 hover:to-pink-500 hover:shadow-medium-modern",
        secondary:
          "border-modern bg-glass-medium text-primary hover:bg-glass-strong hover:border-modern-hover",
        destructive:
          "border-transparent bg-gradient-to-r from-red-500 to-red-600 text-white shadow-soft-modern hover:from-red-400 hover:to-red-500",
        outline: "text-primary border-modern hover:bg-glass-light",
        success:
          "border-transparent bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-soft-modern hover:from-emerald-400 hover:to-emerald-500",
        warning:
          "border-transparent bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-soft-modern hover:from-amber-400 hover:to-amber-500",
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
