/** Correo con acceso a herramientas internas (p. ej. Configuración). */
export const DEV_ADMIN_EMAIL = 'evalencia@dataget.app'

export function isDevAdminEmail(email?: string | null): boolean {
  return Boolean(email?.trim().toLowerCase() === DEV_ADMIN_EMAIL)
}
