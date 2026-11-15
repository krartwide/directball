import * as Dialog from '@radix-ui/react-dialog'
import * as Slider from '@radix-ui/react-slider'
import * as Switch from '@radix-ui/react-switch'
import * as Tabs from '@radix-ui/react-tabs'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      tone: {
        amber: 'bg-amber text-ink hover:brightness-110',
        ghost: 'border border-line bg-white/5 text-foam hover:bg-white/10',
        teal: 'bg-teal text-ink hover:brightness-110',
        danger: 'bg-clay text-white hover:brightness-110',
      },
      size: {
        md: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
      },
    },
    defaultVariants: { tone: 'amber', size: 'md' },
  },
)

export function Button({
  tone,
  size,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return <button className={cn(buttonStyles({ tone, size }), className)} {...props} />
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-10 w-full rounded-xl border border-line bg-ink/60 px-3 text-sm text-foam outline-none focus:border-teal',
        props.className,
      )}
    />
  )
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-10 w-full rounded-xl border border-line bg-ink/60 px-3 text-sm text-foam outline-none focus:border-teal',
        props.className,
      )}
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs font-bold tracking-wide text-mist">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Range({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <Slider.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(next) => onChange(next[0] ?? value)}
      className="relative flex h-5 w-full touch-none items-center"
    >
      <Slider.Track className="relative h-1.5 grow rounded-full bg-white/10">
        <Slider.Range className="absolute h-full rounded-full bg-amber" />
      </Slider.Track>
      <Slider.Thumb className="block size-4 rounded-full border border-black/20 bg-amber shadow" />
    </Slider.Root>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 text-sm text-foam">
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-6 w-11 rounded-full bg-white/15 data-[state=checked]:bg-teal"
      >
        <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white transition data-[state=checked]:translate-x-5" />
      </Switch.Root>
      {label}
    </label>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(560px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-3xl border border-line bg-panel p-5 shadow-2xl">
          <Dialog.Title className="font-display text-3xl text-foam">{title}</Dialog.Title>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const TabRoot = Tabs.Root
export const TabList = (props: { children: ReactNode }) => (
  <Tabs.List className="flex gap-1 overflow-auto rounded-full bg-white/5 p-1">{props.children}</Tabs.List>
)
export function TabTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className="rounded-full px-3 py-1.5 text-sm text-mist data-[state=active]:bg-amber data-[state=active]:text-ink"
    >
      {children}
    </Tabs.Trigger>
  )
}
export const TabContent = Tabs.Content
