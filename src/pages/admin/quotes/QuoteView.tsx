import React from 'react';

// --- ANÁLISIS DEL CÓDIGO PROPORCIONADO ---
// 1. El código HTML es sólido y usa clases de Tailwind. ¡Bien hecho!
// 2. La lógica para los modos 'simplified' y 'detailed' es clara.
// 3. Para mejorarlo, he hecho lo siguiente:
//    - Creado un tipo `QuoteData` para asegurar que los datos que recibe el componente son correctos.
//    - Añadido cálculos para evitar errores (como división por cero) y para formatear monedas de forma robusta.
//    - Envuelto todo en un componente React completo y reutilizable (`QuoteTemplate`).
//    - Integrado tu `tbody` dentro de una estructura de tabla y página HTML completa.

// --- TIPOS DE DATOS ---
type QuoteData = {
  quote_no: string;
  created_at: string;
  mode: 'aereo' | 'maritimo';
  terms: string; // INCOTERM
  destination: string;
  currency: string;
  boxes: number;
  weight_kg: number;
  total: number;
  payment_terms: string;
  client_snapshot: {
    name: string;
    address: string;
    country: string;
  };
  product_details: {
    name: string;
    variety: string;
  };
  // Para el modo detallado
  costs?: {
    s_fruit: number;
    s_packing: number;
    s_logistics: number;
    s_freight: number;
  };
};

type QuoteTemplateProps = {
  data: QuoteData;
  viewMode: 'simplified' | 'detailed';
};

// --- COMPONENTE DE LA PLANTILLA HTML ---
export const QuoteTemplate: React.FC<QuoteTemplateProps> = ({ data, viewMode }) => {
  const colors = { darkGreen: '#234d23', forestGreen: '#277632', accentOcre: '#d17711' };

  // --- Mejoras y Cálculos ---
  const unitPrice = data.boxes > 0 ? (data.total / data.boxes) : 0;
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency || 'USD' }).format(value);
  const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);

  const productCostPerBox = (data.costs?.s_fruit || 0) + (data.costs?.s_packing || 0);
  const totalProductCost = productCostPerBox * data.boxes;
  const totalLogisticsCost = (data.costs?.s_logistics || 0) * data.boxes;
  const totalFreightCost = data.costs?.s_freight || 0;
  const freightCostPerBox = data.boxes > 0 ? totalFreightCost / data.boxes : 0;
  
  return (
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
        <title>Cotización {data.quote_no}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          body { font-family: 'Inter', sans-serif; }
          @media print {
            @page { size: A4; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>
      </head>
      <body className="bg-slate-100">
        <div className="flex justify-center bg-slate-100 py-10 print:p-0 print:bg-white font-sans">
          <div className="bg-white shadow-2xl print:shadow-none overflow-hidden" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', position: 'relative', color: '#000' }}>
            <div className="flex justify-between items-start border-b-4 mb-6" style={{ borderColor: colors.forestGreen }}>
              <div className="flex flex-col pb-4">
                <img src="/brand/freshfood_logo.svg" alt="Fresh Food Panama" className="w-52 mb-2" />
                <div className="text-[10px] leading-tight" style={{ color: colors.darkGreen }}>
                  <p className="font-bold text-xs">Fresh Food Panamá, C.A.</p>
                  <p>RUC: 155XXXX-X-XXXXXX DV XX</p>
                  <p>Panamá, Ciudad de Panamá</p>
                  <p>Email: exports@freshfoodpanama.com</p>
                </div>
              </div>
              <div className="text-right uppercase">
                <h1 className="text-3xl font-black tracking-tighter" style={{ color: colors.darkGreen }}>Cotización</h1>
                <p className="font-bold text-xl" style={{ color: colors.accentOcre }}>{data.quote_no || 'FFP-001'}</p>
                <div className="mt-2 text-[10px] text-slate-500 normal-case">
                  <p>Fecha de emisión: <span className="font-bold">{new Date(data.created_at).toLocaleDateString('es-PA')}</span></p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="border-l-4 pl-4" style={{ borderColor: colors.accentOcre }}>
                <h3 className="text-[9px] uppercase tracking-widest font-bold opacity-50">Importador / Destinatario</h3>
                <p className="font-bold text-lg leading-tight" style={{ color: colors.darkGreen }}>{data.client_snapshot.name || 'CLIENTE'}</p>
                <p className="text-sm">{data.client_snapshot.address || 'Dirección'}</p>
                <p className="text-sm font-bold uppercase">{data.client_snapshot.country || 'País'}</p>
              </div>
              <div className="grid grid-cols-2 text-[11px] gap-y-3 p-4 rounded-lg border" style={{ backgroundColor: '#f9faf9', borderColor: colors.forestGreen + '20' }}>
                <div><p className="font-bold opacity-60" style={{ color: colors.darkGreen }}>MODO:</p><p className="uppercase font-semibold">{data.mode}</p></div>
                <div><p className="font-bold opacity-60" style={{ color: colors.darkGreen }}>INCOTERM:</p><p className="uppercase font-semibold">{data.terms}</p></div>
                <div><p className="font-bold opacity-60" style={{ color: colors.darkGreen }}>DESTINO:</p><p className="uppercase font-semibold">{data.destination}</p></div>
                <div><p className="font-bold opacity-60" style={{ color: colors.darkGreen }}>MONEDA:</p><p className="uppercase font-bold" style={{ color: colors.accentOcre }}>{data.currency}</p></div>
              </div>
            </div>
            <table className="w-full mb-10 overflow-hidden rounded-t-lg">
              <thead className="text-[10px] uppercase tracking-wider">
                <tr className="text-white" style={{ backgroundColor: colors.darkGreen }}>
                  <th className="py-4 px-4 text-left font-medium">Descripción</th>
                  <th className="py-4 px-2 text-center font-medium">Cantidad</th>
                  <th className="py-4 px-2 text-right font-medium">Precio Unit.</th>
                  <th className="py-4 px-4 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="text-[11px]">
                {viewMode === 'simplified' ? (
                  <tr className="border-b border-slate-100">
                    <td className="py-6 px-4"><p className="font-bold text-slate-900 uppercase">{data.product_details.name}</p><p className="text-[9px] text-slate-500">Servicio de Exportación Puesto en Destino ({data.terms})</p></td>
                    <td className="py-6 px-2 text-center font-medium">{formatNumber(data.boxes)} Cajas</td>
                    <td className="py-6 px-2 text-right text-slate-600">{formatCurrency(unitPrice)}</td>
                    <td className="py-6 px-4 text-right font-bold text-lg" style={{ color: colors.forestGreen }}>{formatCurrency(data.total)}</td>
                  </tr>
                ) : (
                  <>
                    <tr className="border-b border-slate-100 bg-slate-50/60"><td className="py-3 px-4"><p className="font-bold text-slate-800 uppercase">1. Producto y Empaque (EXW)</p><p className="text-[9px] text-slate-500">Fruta seleccionada + Materiales de empaque</p></td><td className="py-3 px-2 text-center">{formatNumber(data.boxes)}</td><td className="py-3 px-2 text-right text-slate-500">{formatCurrency(productCostPerBox)}</td><td className="py-3 px-4 text-right font-semibold">{formatCurrency(totalProductCost)}</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-3 px-4"><p className="font-medium text-slate-700">2. Gastos Logísticos y Origen</p><p className="text-[9px] text-slate-500">Transporte interno, manejo y fitosanitarios</p></td><td className="py-3 px-2 text-center">-</td><td className="py-3 px-2 text-right text-slate-500">{formatCurrency(data.costs?.s_logistics || 0)}</td><td className="py-3 px-4 text-right text-slate-500">{formatCurrency(totalLogisticsCost)}</td></tr>
                    <tr className="border-b-2" style={{ borderColor: colors.darkGreen }}><td className="py-3 px-4"><p className="font-bold text-slate-800 uppercase">3. Flete Internacional ({data.mode})</p><p className="text-[9px] text-slate-500">Tarifa base + Recargos de combustible</p></td><td className="py-3 px-2 text-center">1 Lote</td><td className="py-3 px-2 text-right text-slate-500"><span className="text-[9px] block">Unitario: {formatCurrency(freightCostPerBox)}</span></td><td className="py-3 px-4 text-right font-semibold">{formatCurrency(totalFreightCost)}</td></tr>
                  </>
                )}
              </tbody>
            </table>
            <div className="flex justify-between items-start">
              <div className="w-1/2 text-[10px] text-slate-500 leading-relaxed pr-10">
                <h4 className="font-bold mb-1" style={{ color: colors.darkGreen }}>TÉRMINOS DE PAGO:</h4>
                <p className="mb-4 uppercase">{data.payment_terms || 'A convenir'}</p>
                <h4 className="font-bold mb-1" style={{ color: colors.darkGreen }}>OBSERVACIONES:</h4>
                <p>- Cotización basada en disponibilidad de cosecha y logística.</p>
                <p>- Precios incluyen flete interno en Panamá y servicios aduanales.</p>
              </div>
              <div className="w-1/3">
                <div className="p-5 rounded-xl shadow-lg text-white flex justify-between items-center" style={{ backgroundColor: colors.accentOcre }}>
                  <span className="font-bold uppercase text-[10px] tracking-widest">Total ({data.terms})</span>
                  <span className="text-2xl font-black tracking-tighter">{formatCurrency(data.total)}</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-[15mm] left-[15mm] right-[15mm]">
              <div className="grid grid-cols-2 gap-20 text-center text-[10px] font-bold" style={{ color: colors.darkGreen }}><div className="border-t pt-4 opacity-40 uppercase" style={{ borderColor: colors.darkGreen }}>Fresh Food Panamá</div><div className="border-t pt-4 opacity-40 uppercase" style={{ borderColor: colors.darkGreen }}>Aceptado Importador</div></div>
              <div className="mt-8 text-center text-[8px] opacity-40 pt-4 border-t" style={{ borderColor: '#eee' }}>Fresh Food Panamá, C.A. • Calidad de Exportación • Panamá • www.freshfoodpanama.com</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
};

// Este archivo ahora exporta la plantilla, pero no es una página renderizable por sí misma.
// Para usarla, impórtala en otra página (como [id].tsx) y renderízala a un string.
const QuoteViewPage = () => {
  return (
    <div className="p-10 bg-gray-100 min-h-screen">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-800">Plantilla de Cotización</h1>
        <p className="mt-2 text-gray-600">
          Este archivo (`QuoteView.tsx`) contiene el componente `QuoteTemplate` para generar el HTML de la cotización.
        </p>
        <p className="mt-4 text-sm text-gray-500">
          No está diseñado para ser una página visible directamente. En su lugar, la página de detalle de una cotización (`/admin/quotes/[id].tsx`) usará este componente para generar el PDF/HTML para imprimir.
        </p>
      </div>
    </div>
  );
}

export default QuoteViewPage;