import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { RequireAppAccess, RequireBodega, RequireCotizaciones, RequireDashboard, RequireGestion, RequireManageUsers } from '@/auth/RequireAccess'
import { BrandProvider } from '@/config/BrandProvider'
import { SedesProvider } from '@/config/SedesProvider'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import ClientesPage from '@/features/clientes/ClientesPage'
import VehiculosPage from '@/features/vehiculos/VehiculosPage'
import VehiculoDetallePage from '@/features/vehiculos/VehiculoDetallePage'
import ProveedoresPage from '@/features/proveedores/ProveedoresPage'
import TecnicosPage from '@/features/tecnicos/TecnicosPage'
import TecnicoDetallePage from '@/features/tecnicos/TecnicoDetallePage'
import CatalogoPage from '@/features/catalogo/CatalogoPage'
import BodegaPage from '@/features/bodega/BodegaPage'
import OrdenesPage from '@/features/ordenes/OrdenesPage'
import OrdenDetallePage from '@/features/ordenes/OrdenDetallePage'
import ReportesPage from '@/features/reportes/ReportesPage'
import UsuariosPage from '@/features/usuarios/UsuariosPage'
import CotizacionesPage from '@/features/cotizaciones/CotizacionesPage'
import CotizacionDetallePage from '@/features/cotizaciones/CotizacionDetallePage'
import ConfiguracionPage from '@/features/configuracion/ConfiguracionPage'
import PerfilPage from '@/features/auth/PerfilPage'

export default function App() {
  return (
    <BrandProvider>
      <AuthProvider>
        <SedesProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAppAccess />}>
                <Route element={<AppShell />}>
                  <Route element={<RequireDashboard />}>
                    <Route index element={<DashboardPage />} />
                  </Route>
                  <Route path="ordenes" element={<OrdenesPage />} />
                  <Route path="ordenes/:id" element={<OrdenDetallePage />} />
                  <Route element={<RequireCotizaciones />}>
                    <Route path="cotizaciones" element={<CotizacionesPage />} />
                    <Route path="cotizaciones/:id" element={<CotizacionDetallePage />} />
                  </Route>
                  <Route element={<RequireBodega />}>
                    <Route path="bodega" element={<BodegaPage />} />
                  </Route>
                  <Route element={<RequireGestion />}>
                    <Route path="vehiculos" element={<VehiculosPage />} />
                    <Route path="vehiculos/:id" element={<VehiculoDetallePage />} />
                    <Route path="clientes" element={<ClientesPage />} />
                    <Route path="proveedores" element={<ProveedoresPage />} />
                    <Route path="tecnicos" element={<TecnicosPage />} />
                    <Route path="tecnicos/:id" element={<TecnicoDetallePage />} />
                    <Route path="catalogo" element={<CatalogoPage />} />
                    <Route path="reportes" element={<ReportesPage />} />
                    <Route element={<RequireManageUsers />}>
                      <Route path="usuarios" element={<UsuariosPage />} />
                    </Route>
                  </Route>
                  <Route path="perfil" element={<PerfilPage />} />
                  <Route path="configuracion" element={<ConfiguracionPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SedesProvider>
      </AuthProvider>
    </BrandProvider>
  )
}
