import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-modern bg-glass-light backdrop-blur-[12px] px-4 py-3 text-base font-medium text-primary ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/30 focus-visible:ring-offset-2 focus-visible:border-pink-500 focus-visible:bg-glass-medium hover:bg-glass-medium hover:border-modern-hover disabled:cursor-not-allowed disabled:opacity-50 md:text-sm shadow-soft-modern",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
