import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-[76px] w-full rounded-[10px] border border-[var(--border-md)] bg-[var(--white)] px-3 py-2 text-[13px] leading-relaxed text-[var(--text)] transition-[color,box-shadow] outline-none placeholder:text-[var(--text-hint)] focus-visible:border-[var(--purple-mid)] focus-visible:ring-[3px] focus-visible:ring-[var(--purple-light)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--red)] aria-invalid:ring-[3px] aria-invalid:ring-[var(--red-bg)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
