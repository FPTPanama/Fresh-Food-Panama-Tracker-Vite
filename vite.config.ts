import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mantenemos solo el alias @ porque tu código lo usa mucho
      '@': resolve(__dirname, './src'),
    },
  },
  // Eliminamos el server y el proxy por ahora para ver si el build limpia errores
});