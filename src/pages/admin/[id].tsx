import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Ruta catch-all /admin/[id] - redirige al dashboard.
 * Las rutas específicas (clients, shipments, quotes) tienen sus propios [id].
 */
export default function AdminIdRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin");
  }, [router]);

  return null;
}
