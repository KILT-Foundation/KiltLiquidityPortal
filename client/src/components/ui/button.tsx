import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-medium-modern hover:from-pink-400 hover:to-pink-500 hover:shadow-strong-modern hover:-translate-y-0.5",
        destructive:
          "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-medium-modern hover:from-red-400 hover:to-red-500 hover:shadow-strong-modern hover:-translate-y-0.5",
        outline:
          "border border-modern bg-glass-light text-primary hover:bg-glass-medium hover:border-modern-hover backdrop-blur-[12px]",
        secondary:
          "bg-glass-medium text-primary hover:bg-glass-strong backdrop-blur-[16px] border border-modern",
        ghost: "text-primary hover:bg-glass-light",
        link: "text-accent-pink underline-offset-4 hover:underline font-medium",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
