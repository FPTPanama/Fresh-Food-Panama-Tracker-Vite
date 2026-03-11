

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { supabase } from "../../../../lib/supabaseClient"; 
import { QuoteTemplate } from "../QuoteView";

export default function QuotePrintPage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchQuote = async () => {
      try {
        const { data: quote, error } = await supabase
          .from("quotes")
          .select(`*, clients (*)`)
          .eq("id", id)
          .single();

        if (error) throw error;

        if (quote) {
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
            client_snapshot: {
              name: quote.clients?.name || "Cliente",
              address: quote.clients?.address || "",
              country: quote.clients?.country || "",
            },
            product_details: {
              name: quote.product_name || "Fruta Fresca",
              variety: quote.product_details?.variety || "",
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

  useEffect(() => {
    if (!loading && data) {
      setTimeout(() => window.print(), 1000);
    }
  }, [loading, data]);

  if (loading) return <div className="p-10 font-sans">Preparando documento...</div>;
  if (!data) return <div className="p-10 font-sans text-red-500">Error: No se encontró la cotización.</div>;

  return (
    <>
      <div className="no-print fixed top-4 right-4 z-50">
        <button onClick={() => window.print()} className="bg-green-600 text-white px-5 py-2 rounded-lg font-bold">
          Imprimir PDF
        </button>
      </div>
      <QuoteTemplate data={data} viewMode="detailed" />
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #475569; padding: 40px 0; }
        }
      `}</style>
    </>
  );
}