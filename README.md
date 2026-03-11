# Fresh Food Panamá Tracker (MVP)

Portal de clientes + panel admin para seguimiento manual de exportación de piñas.

## Requisitos
- Node.js 18+
- Cuenta en Supabase
- Netlify (ya tienes Premium)

## Variables de entorno
Crea un archivo `.env.local` para desarrollo:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_URL=...
```

**Desarrollo contra deploy de Netlify:** Para que el login y los datos funcionen en local usando las funciones del sitio desplegado, añade en `.env.local`:

```
NEXT_PUBLIC_NETLIFY_URL=https://tu-sitio.netlify.app
```

⚠️ **No definas** `NEXT_PUBLIC_NETLIFY_URL` en las variables de Netlify. Solo debe estar en `.env.local`. Si está en Netlify, la preview (y el deploy) haría peticiones a otra URL → errores de CORS.

En Netlify, crea variables (Site settings → Environment variables):

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY  (solo backend/functions)

## Base de datos
Ejecuta los scripts en `sql/01_schema.sql` y luego `sql/02_rls.sql` en el SQL Editor de Supabase.

## Correr local
```
npm install
npm run dev
```

## Deploy en Netlify
- Conecta el repo
- Build command: `npm run build`
- Publish: `.next`
- Agrega el plugin `@netlify/plugin-nextjs` (incluido en netlify.toml)

## Funciones
- `listShipments`
- `getShipment`
- `createShipment`
- `updateMilestone`
- `getUploadUrl`
- `registerFile`
- `getDownloadUrl`

