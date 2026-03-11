import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// 1. Ruta a Supabase (3 niveles arriba desde 'print')
import { supabase } from "../../../lib/supabaseClient"; 

// 2. Ruta a QuoteView (Depende de dónde quedó al final)
// Si NO lo moviste y sigue en admin/quotes/QuoteView.tsx:
import { QuoteTemplate } from "../../../components/QuoteView";

export default function QuotePrintPage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || id === 'test') return; // Evitamos que intente buscar 'test' en la DB

    const fetchQuote = async () => {
  try {
    setLoading(true);
    // Agregamos 'error' a la desestructuración para que 'if (error)' no falle
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*, v_clients_overview(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (quote) {
      // Extraemos los datos de la vista de cliente
      const clientView = quote.v_clients_overview || {};

      setData({
        quote_no: quote.quote_number || `Q-${String(quote.id).slice(0, 5)}`,
        created_at: quote.created_at,
        mode: (quote.mode || "AIR").toLowerCase(),
        terms: quote.totals?.meta?.incoterm || "CIP",
        destination: quote.destination || "Panamá",
        currency: quote.currency || "USD",
        boxes: quote.boxes || 0,
        weight_kg: quote.weight_kg || 0,
        total: quote.total || 0,
        payment_terms: quote.payment_terms || "Contado",
        
        // MAPEADO DESDE V_CLIENTS_OVERVIEW
        client_snapshot: {
          name: clientView.legal_name || clientView.full_name || quote.client_snapshot?.name || "Cliente",
          tax_id: clientView.tax_id || clientView.ruc || quote.client_snapshot?.tax_id || "N/A",
          address: clientView.address || clientView.billing_address || quote.client_snapshot?.address || "",
          country: clientView.country || quote.client_snapshot?.country || "",
          email: clientView.email || quote.client_snapshot?.email || ""
        },

        product_details: {
          name: quote.product_name || "Fruta Fresca",
          variety: quote.product_details?.variety || "",
          brix: quote.product_details?.brix || "N/A",
          color: quote.product_details?.color || "N/A"
        },

        costs: {
          s_fruit: quote.costs?.s_fruit || 0,
          s_packing: 0,
          s_logistics: quote.costs?.s_origin || 0,
          s_freight: quote.costs?.s_freight || 0,
        }
      });
    }
  } catch (err) {
    console.error("Error cargando cotización:", err);
  } finally {
    setLoading(false);
  }
};

    fetchQuote();
  }, [id]);

  // Auto-impresión
  useEffect(() => {
    if (!loading && data) {
      setTimeout(() => window.print(), 1000);
    }
  }, [loading, data]);

  if (loading && id !== 'test') return <div className="p-10 font-sans text-white">Preparando documento...</div>;
  if (!data && id !== 'test') return <div className="p-10 font-sans text-red-500">Error: No se encontró la cotización.</div>;

  return (
    <>
      <div className="no-print fixed top-4 right-4 z-50">
        <button onClick={() => window.print()} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-bold shadow-lg transition-all">
          🖨️ Imprimir PDF
        </button>
      </div>

      {/* Solo mostramos la plantilla si hay datos */}
      {data && <QuoteTemplate data={data} viewMode="detailed" />}

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #1e293b; padding: 40px 0; }
        }
      `}</style>
    </>
  );
}