import { describe, expect, it } from 'vitest'
import { extractDateOnly, parseLocalDate, setActiveFormatSettings, todayISO } from '@/lib/format'
import { estadoTrasLiberarInstalacion } from '@/services/repuestosOt'

describe('fechas locales', () => {
  it('no recorta un día al leer un timestamp UTC', () => {
    expect(extractDateOnly('2026-01-01T00:00:00.000Z')).toBe('2026-01-01')
    expect(extractDateOnly('2026-09-25')).toBe('2026-09-25')
  })

  it('interpreta YYYY-MM-DD como calendario local', () => {
    const date = parseLocalDate('2026-09-25')
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(8)
    expect(date?.getDate()).toBe(25)
  })

  it('todayISO usa la zona del branding', () => {
    setActiveFormatSettings({ timeZone: 'America/Guatemala', locale: 'es-GT', currency: 'GTQ' })
    const expected = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guatemala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    expect(todayISO()).toBe(expected)
  })
})

describe('repuesto de cliente', () => {
  it('al liberar vuelve a recibido si ya tenía recepción', () => {
    expect(estadoTrasLiberarInstalacion('2026-09-01')).toBe('recibido')
  })

  it('al liberar vuelve a solicitado si nunca se recibió', () => {
    expect(estadoTrasLiberarInstalacion('')).toBe('solicitado')
    expect(estadoTrasLiberarInstalacion(null)).toBe('solicitado')
  })
})
