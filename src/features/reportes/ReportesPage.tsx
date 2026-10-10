import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, Search } from 'lucide-react'
import {
  ordenesService,
  inventarioService,
  trabajosProgramadosService,
  clientesService,
} from '@/services'
import { usePermissions } from '@/auth/AuthContext'
import type { Cliente, EstadoFactura, OrdenTrabajo } from '@/types/collections'
import { formatCurrency, todayISO } from '@/lib/format'
import { listAllPages } from '@/lib/listAll'
import { errorMessage } from '@/lib/pbError'
import { displayOtId } from '@/lib/otId'
import { exportOcEnvioReport } from '@/lib/excel/ocEnvioReport'
import { downloadTrabajosPorDescripcionExcel } from '@/lib/excel/trabajosPorDescripcionReport'
import {
  searchTrabajosPorDescripcion,
  type TrabajoDescripcionReportRow,
} from '@/lib/reportes/trabajosPorDescripcion'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { StatusBadge } from '@/components/ui/Badges'
import { PageHeader, Card, LoadingState, DataSourceBadge, SectionTitle, EmptyState } from '@/components/ui/Page'

const ESTADOS: EstadoFactura[] = ['En Proceso', 'Terminada', 'Esperando OC', 'OC Recibida', 'Facturada']

function monthStartISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export default function ReportesPage() {
  const permissions = usePermissions()
  const sedeFilter = permissions.otFilterBySede ? permissions.sede : null

  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)
  const [totalOts, setTotalOts] = useState(0)
  const [porEstado, setPorEstado] = useState<Record<string, number>>({})
  const [ingresosFacturadas, setIngresosFacturadas] = useState(0)
  const [topOts, setTopOts] = useState<OrdenTrabajo[]>([])
  const [lowStock, setLowStock] = useState(0)
  const [pendientes, setPendientes] = useState(0)
  const [ocDesde, setOcDesde] = useState(monthStartISO)
  const [ocHasta, setOcHasta] = useState(todayISO)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  const [descQuery, setDescQuery] = useState('')
  const [descDesde, setDescDesde] = useState('')
  const [descHasta, setDescHasta] = useState('')
  const [descClienteId, setDescClienteId] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [descSearching, setDescSearching] = useState(false)
  const [descSearched, setDescSearched] = useState(false)
  const [descRows, setDescRows] = useState<TrabajoDescripcionReportRow[]>([])
  const [descMsg, setDescMsg] = useState('')
  const [descFromMock, setDescFromMock] = useState(false)
  const [descExporting, setDescExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [totalRes, lowRes, pendRes, cliRes, topRes, ...estadoRes] = await Promise.all([
          ordenesService.list({ page: 1, perPage: 1, fields: 'id' }),
          inventarioService.list({
            page: 1,
            perPage: 1,
            filter: 'stockActual < 5',
            fields: 'id',
          }),
          trabajosProgramadosService.list({
            page: 1,
            perPage: 1,
            filter: 'estado = "pendiente"',
            fields: 'id',
          }),
          clientesService.getFullList({ sort: 'nombre', fields: 'id,nombre' }),
          ordenesService.list({
            page: 1,
            perPage: 8,
            sort: '-totalVenta',
            fields: 'id,idInterno,estadoFactura,totalVenta',
          }),
          ...ESTADOS.map((estado) =>
            ordenesService.list({
              page: 1,
              perPage: 1,
              filter: `estadoFactura = "${estado}"`,
              fields: 'id',
            }),
          ),
        ])
        const facturadas = await listAllPages((page, perPage) =>
          ordenesService.list({
            page,
            perPage,
            filter: 'estadoFactura = "Facturada"',
            fields: 'id,totalVenta',
          }),
        )
        if (cancelled) return
        const counts: Record<string, number> = {}
        ESTADOS.forEach((estado, index) => {
          counts[estado] = estadoRes[index]?.totalItems ?? 0
        })
        setTotalOts(totalRes.totalItems)
        setPorEstado(counts)
        setIngresosFacturadas(facturadas.reduce((sum, ot) => sum + (ot.totalVenta ?? 0), 0))
        setTopOts(topRes.items)
        setLowStock(lowRes.totalItems)
        setPendientes(pendRes.totalItems)
        setClientes(cliRes.items)
        setFromMock(totalRes.fromMock)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleExportOc() {
    setExportMsg('')
    setExporting(true)
    try {
      const count = await exportOcEnvioReport(ocDesde, ocHasta)
      setExportMsg(
        count === 0
          ? 'No hay órdenes con fecha de envío OC en ese rango. Se descargó un Excel vacío con encabezados.'
          : `Exportadas ${count} orden${count === 1 ? '' : 'es'}.`,
      )
    } catch (err) {
      setExportMsg(errorMessage(err, 'No se pudo generar el Excel'))
    } finally {
      setExporting(false)
    }
  }

  async function handleSearchDescripcion() {
    setDescMsg('')
    setDescSearching(true)
    setDescSearched(true)
    try {
      const { rows, fromMock: mock } = await searchTrabajosPorDescripcion(descQuery, {
        sede: sedeFilter,
        desde: descDesde || null,
        hasta: descHasta || null,
        clienteId: descClienteId || null,
      })
      setDescRows(rows)
      setDescFromMock(mock)
      setDescMsg(
        rows.length === 0
          ? 'No se encontraron trabajos con esos criterios.'
          : `${rows.length} registro${rows.length === 1 ? '' : 's'} encontrado${rows.length === 1 ? '' : 's'}.`,
      )
    } catch (err) {
      setDescRows([])
      setDescMsg(errorMessage(err, 'No se pudo buscar'))
    } finally {
      setDescSearching(false)
    }
  }

  function handleExportDescripcion() {
    if (descRows.length === 0) return
    setDescExporting(true)
    try {
      downloadTrabajosPorDescripcionExcel(descRows, descQuery)
      setDescMsg(`Exportados ${descRows.length} registro${descRows.length === 1 ? '' : 's'} a Excel.`)
    } catch (err) {
      setDescMsg(errorMessage(err, 'No se pudo generar el Excel'))
    } finally {
      setDescExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Reportes" subtitle="Analítica operativa del taller" />
        <div className="px-4 py-4 sm:px-8 sm:py-6">
          <Card>
            <LoadingState />
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Reportes"
        subtitle="Analítica operativa del taller"
        actions={<DataSourceBadge fromMock={fromMock || descFromMock} />}
      />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Ingresos facturados" value={formatCurrency(ingresosFacturadas)} highlight />
          <MetricCard label="Stock bajo (<5)" value={String(lowStock)} warn={lowStock > 0} />
          <MetricCard label="Trabajos programados" value={String(pendientes)} />
          <MetricCard label="Total OTs" value={String(totalOts)} />
        </div>

        <Card>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--brand-border)' }}>
            <SectionTitle>Buscar trabajos por descripción</SectionTitle>
            <p className="text-xs text-slate-400 mt-1">
              Busca una palabra o frase (ej. &quot;Cambio de pastillas&quot;) en las líneas de trabajo. Puedes
              filtrar por rango de fechas de apertura de OT y por cliente
              {sedeFilter ? ` · sede ${sedeFilter}` : ''}.
            </p>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <Field label="Descripción del trabajo" className="sm:col-span-2 lg:col-span-3">
              <Input
                value={descQuery}
                onChange={(e) => setDescQuery(e.target.value)}
                placeholder='Ej. Cambio de pastillas'
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleSearchDescripcion()
                  }
                }}
              />
            </Field>
            <Field label="Desde (apertura OT)">
              <Input type="date" value={descDesde} onChange={(e) => setDescDesde(e.target.value)} />
            </Field>
            <Field label="Hasta (apertura OT)">
              <Input type="date" value={descHasta} onChange={(e) => setDescHasta(e.target.value)} />
            </Field>
            <Field label="Cliente">
              <SearchableSelect
                items={clientes}
                value={descClienteId}
                onChange={setDescClienteId}
                getOptionValue={(c) => c.id}
                getOptionLabel={(c) => c.nombre || c.id}
                filterItem={(c, q) =>
                  (c.nombre ?? '').toLowerCase().includes(q.toLowerCase()) ||
                  (c.telefono ?? '').toLowerCase().includes(q.toLowerCase()) ||
                  (c.nit ?? '').toLowerCase().includes(q.toLowerCase())
                }
                placeholder="Todos los clientes"
                emptyLabel="— Todos —"
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
              <Button
                icon={<Search size={16} />}
                onClick={() => void handleSearchDescripcion()}
                disabled={descSearching || !descQuery.trim()}
              >
                {descSearching ? 'Buscando...' : 'Buscar'}
              </Button>
              <Button
                variant="secondary"
                icon={<FileSpreadsheet size={16} />}
                onClick={handleExportDescripcion}
                disabled={descExporting || descRows.length === 0}
              >
                {descExporting ? 'Exportando...' : 'Exportar Excel'}
              </Button>
            </div>
          </div>
          {descMsg && (
            <p className="px-5 pb-3 text-xs text-slate-500">{descMsg}</p>
          )}
          {descSearched && descRows.length === 0 && !descSearching && (
            <div className="px-5 pb-5">
              <EmptyState
                title="Sin resultados"
                description="Prueba con otra palabra, amplía el rango de fechas o quita el filtro de cliente."
              />
            </div>
          )}
          {descRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--brand-table-head)' }}>
                    {[
                      'Trabajo',
                      'Código',
                      'Cliente',
                      'Kilometraje',
                      'N° OT',
                      'Apertura',
                      'Cierre',
                      'Estado',
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {descRows.map((r) => (
                    <tr key={r.detalleId} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                      <td className="px-4 py-3 text-slate-800 max-w-[220px]">{r.descripcion}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.vehiculoCodigo}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.clienteNombre}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums">
                        {r.kilometraje}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.otRecordId ? (
                          <Link
                            to={`/ordenes/${r.otRecordId}`}
                            className="text-[var(--brand-primary)] hover:underline"
                          >
                            {r.otLabel}
                          </Link>
                        ) : (
                          r.otLabel
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.fechaApertura}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.fechaCierre}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.estado === '—' ? undefined : r.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--brand-border)' }}>
            <SectionTitle>Exportar órdenes enviadas a OC</SectionTitle>
            <p className="text-xs text-slate-400 mt-1">
              Excel con N° OT, código de vehículo, cliente, sede, fecha de apertura, detalle de trabajos, total venta y fecha de
              envío OC. Filtra por rango de fecha de envío.
            </p>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <Field label="Desde (envío OC)">
              <Input type="date" value={ocDesde} onChange={(e) => setOcDesde(e.target.value)} />
            </Field>
            <Field label="Hasta (envío OC)">
              <Input type="date" value={ocHasta} onChange={(e) => setOcHasta(e.target.value)} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-2 flex flex-col gap-2">
              <Button
                icon={<FileSpreadsheet size={16} />}
                onClick={() => void handleExportOc()}
                disabled={exporting || !ocDesde || !ocHasta}
                className="w-full sm:w-auto"
              >
                {exporting ? 'Generando...' : 'Exportar Excel'}
              </Button>
              {exportMsg && <p className="text-xs text-slate-500">{exportMsg}</p>}
            </div>
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--brand-border)' }}>
            <SectionTitle>OTs por estado</SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--brand-table-head)' }}>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">
                    Estado
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">
                    Cantidad
                  </th>
                </tr>
              </thead>
              <tbody>
                {ESTADOS.map((e) => (
                  <tr key={e} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                    <td className="px-4 py-3 font-medium text-slate-800">{e}</td>
                    <td className="px-4 py-3 text-slate-600">{porEstado[e] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--brand-border)' }}>
            <SectionTitle>Top OTs por valor</SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--brand-table-head)' }}>
                  {['N° OT', 'Estado', 'Total venta'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topOts.map((o) => (
                    <tr key={o.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                      <td className="px-4 py-3 font-mono text-xs">{displayOtId(o)}</td>
                      <td className="px-4 py-3 text-slate-600">{o.estadoFactura ?? '—'}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(o.totalVenta)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  highlight,
  warn,
}: {
  label: string
  value: string
  highlight?: boolean
  warn?: boolean
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className="text-2xl font-bold mt-2"
        style={{
          fontFamily: 'var(--font-display)',
          color: warn ? 'var(--brand-warning)' : highlight ? 'var(--brand-primary)' : 'var(--brand-info)',
        }}
      >
        {value}
      </p>
    </Card>
  )
}
