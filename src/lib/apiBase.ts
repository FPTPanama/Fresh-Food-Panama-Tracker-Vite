/**
 * Base URL para las funciones de Netlify.
 * En producción: vacío (usa rutas relativas).
 * En local contra deploy: URL del sitio en Netlify (ej. https://tu-sitio.netlify.app)
 * Configurar en .env.local: NEXT_PUBLIC_NETLIFY_URL=https://tu-sitio.netlify.app
 */
export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_NETLIFY_URL || "";
}
