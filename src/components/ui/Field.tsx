import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

const fieldStyle: React.CSSProperties = {
  background: 'var(--brand-muted-bg)',
  border: '1px solid var(--brand-border)',
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label
      className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
      style={{ color: '#8A95A6', fontFamily: 'var(--font-display)' }}
    >
      {children}
    </label>
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[var(--brand-primary)] ${className}`}
      style={fieldStyle}
    />
  )
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[var(--brand-primary)] min-h-[96px] ${className}`}
      style={fieldStyle}
    />
  )
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[var(--brand-primary)] ${className}`}
      style={fieldStyle}
    >
      {children}
    </select>
  )
}

export function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}
