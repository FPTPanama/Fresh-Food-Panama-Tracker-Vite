export function getApiBase(): string {
  // Si estamos en el navegador y el hostname NO es localhost, 
  // asumimos que estamos en el dominio de Netlify.
  if (window.location.hostname !== 'localhost') {
    // En Netlify, las funciones son relativas al sitio
    return ''; 
  }

  // En local, usamos la variable de entorno o el puerto por defecto de Netlify Dev
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888';
}