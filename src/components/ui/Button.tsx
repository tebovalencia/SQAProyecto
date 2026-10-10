import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variants: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--brand-primary)',
    color: '#fff',
    border: '1px solid var(--brand-primary)',
  },
  secondary: {
    background: 'var(--brand-muted-bg)',
    color: '#4B5563',
    border: '1px solid var(--brand-border)',
  },
  ghost: {
    background: 'transparent',
    color: '#4B5563',
    border: '1px solid transparent',
  },
  danger: {
    background: 'var(--brand-danger-bg)',
    color: 'var(--brand-danger)',
    border: '1px solid #FECACA',
  },
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  style,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      } ${className}`}
      style={{ ...variants[variant], ...style }}
      onMouseEnter={(e) => {
        if (disabled) return
        if (variant === 'primary') e.currentTarget.style.background = 'var(--brand-primary-hover)'
        if (variant === 'secondary') e.currentTarget.style.background = 'var(--brand-border)'
        props.onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary') e.currentTarget.style.background = 'var(--brand-primary)'
        if (variant === 'secondary') e.currentTarget.style.background = 'var(--brand-muted-bg)'
        props.onMouseLeave?.(e)
      }}
    >
      {icon}
      {children}
    </button>
  )
}
