import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileDown, Plus, Trash2 } from 'lucide-react'
import {
  catalogoService,
  clientesService,
  cotizacionesService,
  detalleCotizacionesService,
  vehiculosService,
} from '@/services'
import type {
  CatalogoTrabajo,
  Cliente,
  Cotizacion,
  DetalleCotizacion,
  EstadoCotizacion,
  TipoLineaCotizacion,
  Vehiculo,
} from '@/types/collections'
import { formatCurrency, formatDateInput, numberInputValue, parseNumberInput, todayISO } from '@/lib/format'
import { displayCotizacionId } from '@/lib/cotizacionId'
import { exportCotizacionPdf } from '@/lib/pdf/cotizacionReport'
import { displayVehiculoFull, matchesVehiculoSearch } from '@/lib/vehiculo'
import { CotizacionEstadoBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { PdfPreviewModal } from '@/components/ui/PdfPreviewModal'
import { Card, EmptyState, LoadingState, SectionTitle } from '@/components/ui/Page'
import { usePdfPreview } from '@/lib/pdf/usePdfPreview'

const ESTADOS: EstadoCotizacion[] = [
  'borrador',
  'enviada',
  'aceptada',
  'rechazada',
  'vencida',
]

function calcTotal(lineas: DetalleCotizacion[]): number {
  return lineas.reduce((s, l) => s + (l.precioUnitario ?? 0) * (l.cantidad ?? 1), 0)
}

function sortLineas(items: DetalleCotizacion[]): DetalleCotizacion[] {
  return [...items].sort((a, b) => {
    const ai = a.indice ?? 9999
    const bi = b.indice ?? 9999
    if (ai !== bi) return ai - bi
    return (a.created ?? '').localeCompare(b.created ?? '')
  })
}

export default function CotizacionDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null)
  const [lineas, setLineas] = useState<DetalleCotizacion[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [catalogo, setCatalogo] = useState<CatalogoTrabajo[]>([])
  const [error, setError] = useState('')
  const pdfPreview = usePdfPreview()

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [cotRes, linRes, cliRes, vehRes, catRes] = await Promise.all([
        cotizacionesService.getOne(id, 'clienteId,vehiculoId'),
        detalleCotizacionesService.getFullList({
          filter: `cotizacionId = "${id}"`,
          expand: 'trabajoId',
          sort: 'indice,created',
        }),
        clientesService.getFullList({ sort: 'nombre' }),
        vehiculosService.getFullList({ sort: 'codigoInterno' }),
        catalogoService.getFullList({ sort: 'descripcion' }),
      ])
      setCotizacion(cotRes.item)
      setLineas(sortLineas(linRes.items))
      setClientes(cliRes.items)
      setVehiculos(vehRes.items)
      setCatalogo(catRes.items)
    } catch {
      setCotizacion(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const total = useMemo(() => calcTotal(lineas), [lineas])

  const vehiculosFiltrados = useMemo(() => {
    if (!cotizacion?.clienteId) return vehiculos
    return vehiculos.filter((v) => v.clienteId === cotizacion.clienteId)
  }, [vehiculos, cotizacion?.clienteId])

  async function patchCotizacion(patch: Partial<Cotizacion>) {
    if (!cotizacion) return
    setSaving(true)
    setError('')
    try {
      const { item } = await cotizacionesService.update(cotizacion.id, patch)
      setCotizacion({ ...item, expand: cotizacion.expand })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function syncTotal(nextLineas: DetalleCotizacion[]) {
    if (!cotizacion) return
    const totalVenta = calcTotal(nextLineas)
    const { item } = await cotizacionesService.update(cotizacion.id, { totalVenta })
    setCotizacion((prev) => (prev ? { ...item, expand: prev.expand } : item))
  }

  async function addLinea(tipo: TipoLineaCotizacion) {
    if (!id) return
    const indice = lineas.reduce((m, l) => Math.max(m, l.indice ?? 0), 0) + 1
    const { item } = await detalleCotizacionesService.create({
      cotizacionId: id,
      tipo,
      descripcion: '',
      cantidad: 1,
      precioUnitario: 0,
      indice,
    })
    const next = sortLineas([...lineas, item])
    setLineas(next)
    await syncTotal(next)
  }

  async function updateLinea(row: DetalleCotizacion, patch: Partial<DetalleCotizacion>) {
    const { item } = await detalleCotizacionesService.update(row.id, patch)
    const next = sortLineas(lineas.map((l) => (l.id === row.id ? item : l)))
    setLineas(next)
    if ('precioUnitario' in patch || 'cantidad' in patch) {
      await syncTotal(next)
    }
  }

  async function deleteLinea(row: DetalleCotizacion) {
    if (!confirm('¿Eliminar esta línea?')) return
    await detalleCotizacionesService.remove(row.id)
    const next = lineas.filter((l) => l.id !== row.id)
    setLineas(next)
    await syncTotal(next)
  }

  function onCatalogoSelect(row: DetalleCotizacion, trabajoId: string) {
    const cat = catalogo.find((c) => c.id === trabajoId)
    void updateLinea(row, {
      trabajoId: trabajoId || undefined,
      descripcion: cat?.descripcion ?? row.descripcion,
      precioUnitario: cat?.precio ?? row.precioUnitario ?? 0,
      tipo: 'trabajo',
    })
  }

  async function handlePdf() {
    if (!cotizacion) return
    await pdfPreview.openPreview(`Vista previa ${displayCotizacionId(cotizacion)}`, () =>
      exportCotizacionPdf({
        cotizacion: { ...cotizacion, totalVenta: total },
        lineas,
        cliente: cotizacion.expand?.clienteId,
        vehiculo: cotizacion.expand?.vehiculoId,
      }),
    )
  }

  if (loading) {
    return (
      <div className="flex-1">
        <LoadingState />
      </div>
    )
  }

  if (!cotizacion) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <EmptyState title="Cotización no encontrada" />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/cotizaciones')}>
            Volver
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 sm:px-8 flex flex-col sm:flex-row sm:items-center gap-3"
        style={{ borderBottom: '1px solid var(--brand-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button variant="ghost" size="sm" onClick={() => navigate('/cotizaciones')}>
            <ArrowLeft size={16} />
          </Button>
          <div className="min-w-0">
            <h1
              className="text-lg font-bold text-slate-900 truncate"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Cotización {displayCotizacionId(cotizacion)}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <CotizacionEstadoBadge estado={cotizacion.estado} />
              <span className="text-xs text-slate-400">Total {formatCurrency(total)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<FileDown size={16} />}
            disabled={pdfPreview.busy}
            onClick={() => void handlePdf()}
          >
            {pdfPreview.busy ? 'Generando...' : 'Exportar PDF'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6 space-y-6">
        {error && (
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
          >
            {error}
          </div>
        )}

        <Card className="p-5">
          <SectionTitle>Encabezado</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mt-4">
            <Field label="N°">
              <Input value={cotizacion.idInterno ?? ''} disabled />
            </Field>
            <Field label="Estado">
              <Select
                value={cotizacion.estado ?? 'borrador'}
                disabled={saving}
                onChange={(e) =>
                  void patchCotizacion({ estado: e.target.value as EstadoCotizacion })
                }
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha">
              <Input
                type="date"
                value={formatDateInput(cotizacion.fecha) || todayISO()}
                disabled={saving}
                onChange={(e) => void patchCotizacion({ fecha: e.target.value })}
              />
            </Field>
            <Field label="Válida hasta">
              <Input
                type="date"
                value={formatDateInput(cotizacion.fechaValidez)}
                disabled={saving}
                onChange={(e) => void patchCotizacion({ fechaValidez: e.target.value || undefined })}
              />
            </Field>
            <Field label="Cliente (catálogo)" className="lg:col-span-2">
              <Select
                value={cotizacion.clienteId ?? ''}
                disabled={saving}
                onChange={(e) => {
                  const clienteId = e.target.value
                  const cli = clientes.find((c) => c.id === clienteId)
                  void patchCotizacion({
                    clienteId: clienteId || undefined,
                    clienteNombre: cli?.nombre || cotizacion.clienteNombre,
                    clienteTelefono: cli?.telefono || cotizacion.clienteTelefono,
                  })
                }}
              >
                <option value="">— Manual —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nombre cliente">
              <Input
                value={cotizacion.clienteNombre ?? ''}
                disabled={saving}
                onBlur={(e) => void patchCotizacion({ clienteNombre: e.target.value || undefined })}
                onChange={(e) =>
                  setCotizacion({ ...cotizacion, clienteNombre: e.target.value })
                }
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={cotizacion.clienteTelefono ?? ''}
                disabled={saving}
                onBlur={(e) =>
                  void patchCotizacion({ clienteTelefono: e.target.value || undefined })
                }
                onChange={(e) =>
                  setCotizacion({ ...cotizacion, clienteTelefono: e.target.value })
                }
              />
            </Field>
            <Field label="Kilometraje">
              <Input
                type="number"
                value={cotizacion.kilometraje ?? ''}
                disabled={saving}
                onBlur={(e) =>
                  void patchCotizacion({
                    kilometraje: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                onChange={(e) =>
                  setCotizacion({
                    ...cotizacion,
                    kilometraje: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </Field>
            <Field label="Vehículo" className="sm:col-span-2 lg:col-span-3">
              <SearchableSelect
                items={vehiculosFiltrados}
                value={cotizacion.vehiculoId ?? ''}
                onChange={(vehiculoId) => {
                  const v = vehiculos.find((x) => x.id === vehiculoId)
                  void patchCotizacion({
                    vehiculoId: vehiculoId || undefined,
                    vehiculoLabel: v ? displayVehiculoFull(v) : cotizacion.vehiculoLabel,
                  })
                }}
                getOptionValue={(v) => v.id}
                getOptionLabel={(v) => displayVehiculoFull(v)}
                filterItem={matchesVehiculoSearch}
                placeholder="Buscar vehículo..."
                emptyLabel="— Sin vehículo / manual —"
                disabled={saving}
              />
            </Field>
            <Field label="Vehículo (texto)" className="sm:col-span-2 lg:col-span-4">
              <Input
                value={cotizacion.vehiculoLabel ?? ''}
                disabled={saving}
                onBlur={(e) => void patchCotizacion({ vehiculoLabel: e.target.value || undefined })}
                onChange={(e) =>
                  setCotizacion({ ...cotizacion, vehiculoLabel: e.target.value })
                }
              />
            </Field>
            <Field label="Descripción / alcance" className="sm:col-span-2 lg:col-span-2">
              <Textarea
                value={cotizacion.descripcion ?? ''}
                disabled={saving}
                onBlur={(e) => void patchCotizacion({ descripcion: e.target.value || undefined })}
                onChange={(e) =>
                  setCotizacion({ ...cotizacion, descripcion: e.target.value })
                }
              />
            </Field>
            <Field label="Notas / condiciones" className="sm:col-span-2 lg:col-span-2">
              <Textarea
                value={cotizacion.notas ?? ''}
                disabled={saving}
                onBlur={(e) => void patchCotizacion({ notas: e.target.value || undefined })}
                onChange={(e) => setCotizacion({ ...cotizacion, notas: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            style={{ borderBottom: '1px solid var(--brand-border)' }}
          >
            <SectionTitle>Líneas</SectionTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => void addLinea('trabajo')}>
                Trabajo
              </Button>
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => void addLinea('repuesto')}>
                Repuesto
              </Button>
            </div>
          </div>
          {lineas.length === 0 ? (
            <EmptyState
              title="Sin líneas"
              description="Agrega trabajos o repuestos a la cotización."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--brand-table-head)' }}>
                    {['#', 'Tipo', 'Catálogo', 'Descripción', 'Cant.', 'P. unit.', 'Subtotal', ''].map(
                      (h) => (
                        <th
                          key={h || 'a'}
                          className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2 text-slate-500"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((row, idx) => (
                    <tr key={row.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                      <td className="px-3 py-2 text-slate-500">{row.indice ?? idx + 1}</td>
                      <td className="px-3 py-2">
                        <Select
                          className="text-xs"
                          value={row.tipo ?? 'trabajo'}
                          onChange={(e) =>
                            void updateLinea(row, {
                              tipo: e.target.value as TipoLineaCotizacion,
                              trabajoId: e.target.value === 'repuesto' ? '' : row.trabajoId,
                            })
                          }
                        >
                          <option value="trabajo">Trabajo</option>
                          <option value="repuesto">Repuesto</option>
                        </Select>
                      </td>
                      <td className="px-3 py-2 min-w-[180px]">
                        {row.tipo === 'trabajo' ? (
                          <Select
                            className="text-xs"
                            value={row.trabajoId ?? ''}
                            onChange={(e) => onCatalogoSelect(row, e.target.value)}
                          >
                            <option value="">— Manual —</option>
                            {catalogo.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.codigoTrabajo ? `${c.codigoTrabajo} · ` : ''}
                                {c.descripcion}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 min-w-[220px]">
                        <Input
                          className="text-xs"
                          value={row.descripcion ?? ''}
                          onChange={(e) =>
                            setLineas(
                              lineas.map((l) =>
                                l.id === row.id ? { ...l, descripcion: e.target.value } : l,
                              ),
                            )
                          }
                          onBlur={(e) => void updateLinea(row, { descripcion: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="text-xs w-16"
                          type="number"
                          min={1}
                          value={row.cantidad ?? 1}
                          onChange={(e) =>
                            setLineas(
                              lineas.map((l) =>
                                l.id === row.id
                                  ? { ...l, cantidad: Number(e.target.value) || 1 }
                                  : l,
                              ),
                            )
                          }
                          onBlur={(e) =>
                            void updateLinea(row, {
                              cantidad: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="text-xs w-24"
                          type="number"
                          value={numberInputValue(row.precioUnitario)}
                          onChange={(e) =>
                            setLineas(
                              lineas.map((l) =>
                                l.id === row.id
                                  ? { ...l, precioUnitario: parseNumberInput(e.target.value) }
                                  : l,
                              ),
                            )
                          }
                          onBlur={(e) =>
                            void updateLinea(row, {
                              precioUnitario: parseNumberInput(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {formatCurrency((row.precioUnitario ?? 0) * (row.cantidad ?? 1))}
                      </td>
                      <td className="px-3 py-2">
                        <Button variant="ghost" size="sm" onClick={() => void deleteLinea(row)}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div
            className="px-4 py-3 flex justify-end text-sm font-semibold"
            style={{ borderTop: '1px solid var(--brand-border)' }}
          >
            Total: {formatCurrency(total)}
          </div>
        </Card>

        <p className="text-xs text-slate-400">
          <Link to="/cotizaciones" className="hover:underline" style={{ color: 'var(--brand-primary)' }}>
            ← Volver al listado
          </Link>
        </p>
      </div>

      <PdfPreviewModal
        open={pdfPreview.open}
        title={pdfPreview.title}
        url={pdfPreview.url}
        blob={pdfPreview.blob}
        filename={pdfPreview.filename}
        loading={pdfPreview.loading}
        error={pdfPreview.error}
        onClose={pdfPreview.close}
      />
    </div>
  )
}
