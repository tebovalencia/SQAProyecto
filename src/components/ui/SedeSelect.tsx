import { useMemo } from 'react'
import { useSedes } from '@/config/SedesProvider'
import { sedeSelectOptions } from '@/lib/vehiculo'
import { Select } from '@/components/ui/Field'

/** Select de sede alimentado por PocketBase (fallback local si falla). */
export function SedeSelect({
  value,
  onChange,
  emptyLabel = '— Sin asignar —',
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  emptyLabel?: string
  disabled?: boolean
  className?: string
}) {
  const { sedeOptions } = useSedes()
  const options = useMemo(
    () => sedeSelectOptions(sedeOptions, value),
    [sedeOptions, value],
  )

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    >
      <option value="">{emptyLabel}</option>
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </Select>
  )
}
