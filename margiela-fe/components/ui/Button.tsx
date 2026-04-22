"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  size?: "default" | "sm" | "lg";
  rounded?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "default",
      rounded = false,
      fullWidth = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "uppercase tracking-[0.08em] transition-all duration-300",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          {
            // Variants
            "bg-black text-white hover:opacity-90":
              variant === "primary",
            "bg-transparent text-black border border-black hover:bg-black hover:text-white":
              variant === "secondary",
            // Sizes
            "text-[14px] px-6 py-2.5": size === "sm",
            "text-[14px] px-10 py-3": size === "default",
            "text-[14px] px-12 py-4": size === "lg",
            // Rounded
            "rounded-none": !rounded,
            "rounded-full": rounded,
            // Width
            "w-full": fullWidth,
          },
          className
        )}
        style={{ fontFamily: "'BB', 'Didot', Georgia, serif" }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
