import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-[38px] w-full min-w-0 rounded-[10px] border border-[var(--border-md)] bg-[var(--white)] px-3 py-1 text-[13px] text-[var(--text)] transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--text-hint)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // One look for every field (Putaran 42): 38 px, 13 px text, white surface, blue focus ring.
        "focus-visible:border-[var(--purple-mid)] focus-visible:ring-[3px] focus-visible:ring-[var(--purple-light)]",
        "aria-invalid:border-[var(--red)] aria-invalid:ring-[3px] aria-invalid:ring-[var(--red-bg)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
