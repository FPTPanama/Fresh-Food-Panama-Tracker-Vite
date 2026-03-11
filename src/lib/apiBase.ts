/**
 * Base URL para las funciones de Netlify.
 *
 * - Localhost (dev): usa NEXT_PUBLIC_NETLIFY_URL para apuntar al deploy (ej. producción).
 *   Configurar en .env.local: NEXT_PUBLIC_NETLIFY_URL=https://tu-sitio.netlify.app
 *
 * - Deploy (producción o preview): debe ser vacío para usar rutas relativas (mismo origen).
 *   IMPORTANTE: NO definir NEXT_PUBLIC_NETLIFY_URL en las variables de Netlify.
 *   Si está definida, la preview haría peticiones a producción → CORS.
 */
export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_NETLIFY_URL || "";
}
