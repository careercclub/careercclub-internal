"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  guardUnsaved = true,
  onEscapeKeyDown,
  onInteractOutside,
  onInput,
  onSubmitCapture,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /**
   * Once something has been typed in this popup, Esc, clicking outside and the X ask
   * "Discard your changes?" instead of silently throwing the typing away. Cancel and the
   * form's own buttons are explicit and close normally. One rule for every popup.
   */
  guardUnsaved?: boolean
}) {
  const dirty = React.useRef(false)
  const asking = React.useRef(false)
  const closeRef = React.useRef<HTMLButtonElement>(null)

  function intercept(event: { preventDefault: () => void; defaultPrevented: boolean; detail?: unknown; target?: unknown }) {
    if (event.defaultPrevented) return
    // A popup stacked on top (the discard confirm itself, any confirm) or a toast is not
    // "outside": let it work, and never close this form because of it.
    const original = (event.detail as { originalEvent?: Event } | undefined)?.originalEvent
    const target = (original?.target ?? null) as HTMLElement | null
    if (target?.closest?.("[aria-live], [role=alert], [role=status], [data-select-menu]")) { event.preventDefault(); return }
    if (target?.closest?.('[data-slot="dialog-content"]')) { event.preventDefault(); return }
    if (!guardUnsaved || !dirty.current) return
    event.preventDefault()
    if (asking.current) return
    asking.current = true
    void import("@/app/_components/app-dialog")
      .then(({ confirmAction }) => confirmAction({ title: "Discard your changes?", message: "What you typed in this form will be lost.", confirmLabel: "Discard changes", danger: true }))
      .then((discard) => {
        asking.current = false
        if (discard) { dirty.current = false; closeRef.current?.click() }
      })
  }

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-[var(--radius-xl)] border bg-background p-6 shadow-[0_24px_64px_rgba(10,16,22,0.22)] duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        onEscapeKeyDown={(event) => { onEscapeKeyDown?.(event); intercept(event) }}
        onInteractOutside={(event) => { onInteractOutside?.(event); intercept(event) }}
        onInput={(event) => {
          onInput?.(event)
          const target = event.target as HTMLElement
          if (target.matches?.("input:not([type=search]), textarea, select, [contenteditable=true]")) dirty.current = true
        }}
        onSubmitCapture={(event) => { onSubmitCapture?.(event); dirty.current = false }}
        {...props}
      >
        {children}
        {/* Closes after "Discard changes" — the guarded paths above cannot. */}
        <DialogPrimitive.Close aria-hidden className="hidden" ref={closeRef} tabIndex={-1} />
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            onClick={(event) => intercept(event)}
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  sticky = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
  /** Keeps the actions on screen while a long dialog (default p-6) scrolls. */
  sticky?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        sticky && "sticky -bottom-6 z-10 -mx-6 -mb-6 border-t bg-background px-6 py-3",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
