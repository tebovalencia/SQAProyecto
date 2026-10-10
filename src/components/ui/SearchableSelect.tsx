import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X } from 'lucide-react'

type MenuPos = { top: number; left: number; width: number; maxHeight: number }

export function SearchableSelect<T>({
  items,
  value,
  onChange,
  getOptionValue,
  getOptionLabel,
  filterItem,
  placeholder = 'Buscar...',
  emptyLabel = '— Seleccionar —',
  disabled,
  className = '',
}: {
  items: T[]
  value: string
  onChange: (value: string) => void
  getOptionValue: (item: T) => string
  getOptionLabel: (item: T) => string
  filterItem: (item: T, query: string) => boolean
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  className?: string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)

  const selected = useMemo(
    () => items.find((item) => getOptionValue(item) === value),
    [items, value, getOptionValue],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => filterItem(item, q))
  }, [items, query, filterItem])

  function updateMenuPos() {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 4
    const maxMenu = 224 // ~max-h-56
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8
    const spaceAbove = rect.top - gap - 8
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow
    const maxHeight = Math.max(120, Math.min(maxMenu, openUp ? spaceAbove : spaceBelow))
    const top = openUp ? rect.top - gap - maxHeight : rect.bottom + gap
    const width = Math.max(rect.width, Math.min(448, window.innerWidth - 16))
    let left = rect.left
    if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width
    if (left < 8) left = 8
    setMenuPos({ top, left, width, maxHeight })
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPos()
  }, [open, filtered.length, query])

  useEffect(() => {
    if (!open) return
    function onReposition() {
      updateMenuPos()
    }
    window.addEventListener('resize', onReposition)
    // capture scroll on any scrollable ancestor / page
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function selectValue(next: string) {
    onChange(next)
    setQuery('')
    setOpen(false)
  }

  const fieldStyle: CSSProperties = {
    background: 'var(--brand-muted-bg)',
    border: '1px solid var(--brand-border)',
  }

  const menu =
    open && !disabled && menuPos
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="fixed z-[100] overflow-auto rounded-lg text-sm shadow-lg"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
              background: 'var(--brand-card)',
              border: '1px solid var(--brand-border)',
            }}
          >
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className="w-full text-left px-3 py-2 text-slate-500 hover:bg-slate-50"
                onClick={() => selectValue('')}
              >
                {emptyLabel}
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-slate-400">Sin resultados</li>
            ) : (
              filtered.map((item) => {
                const optionValue = getOptionValue(item)
                const active = optionValue === value
                return (
                  <li key={optionValue}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className="w-full text-left px-3 py-2 text-slate-800 hover:bg-slate-50"
                      style={
                        active
                          ? { background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)' }
                          : undefined
                      }
                      onClick={() => selectValue(optionValue)}
                    >
                      {getOptionLabel(item)}
                    </button>
                  </li>
                )
              })
            )}
          </ul>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className={`relative ${className || 'text-sm'}`}>
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 ${disabled ? 'opacity-60' : ''}`}
        style={fieldStyle}
      >
        <Search size={15} className="shrink-0 text-slate-400" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          className="bg-transparent outline-none text-inherit text-slate-800 w-full min-w-0"
          placeholder={selected ? getOptionLabel(selected) : placeholder}
          value={open ? query : selected ? getOptionLabel(selected) : ''}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setQuery('')
          }}
        />
        {value && !disabled && (
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600"
            aria-label="Limpiar selección"
            onClick={() => selectValue('')}
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </div>
      {menu}
    </div>
  )
}
