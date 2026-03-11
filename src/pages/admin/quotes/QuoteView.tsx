import React, { useEffect } from 'react';
import { useRouter } from 'next/router';

export const QuoteTemplate = ({ data, viewMode }: { data: any; viewMode?: string }) => {
  if (!data) return <p>Cargando datos...</p>;

  return (
    <div className="invoice-box">
      {/* Encabezado: Logo y Datos de Empresa */}
      <table cellPadding="0" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tr className="top">
          <td colSpan={2}>
            <table>
              <tr>
                <td className="title">
                  <h2 style={{ color: '#16a34a', margin: 0 }}>FRESH FOOD PANAMA</h2>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>RUC: 155716550-2-2022-DV 25</p>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="quote-badge">COTIZACIÓN</div>
                  <b>Número:</b> {data.quote_number}<br />
                  <b>Fecha:</b> {new Date().toLocaleDateString()}<br />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {/* Información de Cliente */}
        <tr className="information">
          <td colSpan={2}>
            <table>
              <tr>
                <td>
                  <strong>CLIENTE:</strong><br />
                  {data.clients?.name || 'N/A'}<br />
                  {data.clients?.tax_id || ''}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>DESTINO:</strong><br />
                  {data.destination || 'N/A'}<br />
                  Incoterm: {data.totals?.meta?.incoterm || 'CIP'}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {/* Detalles del Producto */}
        <tr className="heading">
          <td>DESCRIPCIÓN DEL PRODUCTO</td>
          <td style={{ textAlign: 'right' }}>ESPECIFICACIONES</td>
        </tr>
        <tr className="item">
          <td>
            {data.product_name || 'Producto'} <br />
            <small>Variedad: {data.product_details?.variety || 'N/A'}</small>
          </td>
          <td style={{ textAlign: 'right' }}>
            Color: {data.product_details?.color || 'N/A'}<br />
            Brix: {data.product_details?.brix || 'N/A'}
          </td>
        </tr>

        {/* Tabla de Precios */}
        <tr className="heading">
          <td>CONCEPTOS (LOGÍSTICA Y FRUTA)</td>
          <td style={{ textAlign: 'right' }}>TOTAL USD</td>
        </tr>

        {data.totals?.items?.map((item: any, index: number) => (
          <tr className="item" key={index}>
            <td>{item.name}</td>
            <td style={{ textAlign: 'right' }}>${Number(item.total).toFixed(2)}</td>
          </tr>
        ))}

        {/* Totales Finales */}
        <tr className="total">
          <td></td>
          <td style={{ textAlign: 'right' }}>
            <div className="total-highlight">
              <span>PRECIO POR CAJA:</span>
              <span className="amount">USD {Number(data.total).toFixed(2)}</span>
            </div>
            <p style={{ fontSize: '10px', marginTop: '5px' }}>
              Basado en {data.boxes} cajas ({data.weight_kg} Kg)
            </p>
          </td>
        </tr>
      </table>

      {/* ESTILOS CSS PARA QUE SE VEA BIEN */}
      <style jsx>{`
        .invoice-box {
          max-width: 800px;
          margin: auto;
          padding: 30px;
          border: 1px solid #eee;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          font-size: 14px;
          line-height: 24px;
          font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;
          color: #334155;
          background: white;
        }

        .invoice-box table {
          width: 100%;
          line-height: inherit;
          text-align: left;
          border-collapse: collapse;
        }

        .invoice-box table td {
          padding: 5px;
          vertical-align: top;
        }

        .invoice-box table tr.top table td.title {
          font-size: 28px;
          line-height: 35px;
          color: #333;
        }

        .invoice-box table tr.information table td {
          padding-bottom: 40px;
          padding-top: 20px;
        }

        .invoice-box table tr.heading td {
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
          font-weight: bold;
          padding: 10px;
          text-transform: uppercase;
          font-size: 12px;
        }

        .invoice-box table tr.item td {
          border-bottom: 1px solid #f1f5f9;
          padding: 10px;
        }

        .quote-badge {
          background: #16a34a;
          color: white;
          padding: 5px 15px;
          display: inline-block;
          border-radius: 4px;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .total-highlight {
          background: #1e293b;
          color: white;
          padding: 15px;
          border-radius: 8px;
          margin-top: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .amount {
          font-size: 20px;
          font-weight: 900;
        }

        @media print {
          .invoice-box {
            box-shadow: none;
            border: none;
            max-width: 100%;
            padding: 0;
          }
          body { background: white; }
        }
      `}</style>
    </div>
  );
};

/** Página no diseñada para acceso directo; redirige al listado de cotizaciones */
export default function QuoteViewPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/quotes');
  }, [router]);
  return null;
}