import React from 'react';

const LOGO_URL = "/brand/freshfood_logo.png";

export const QuoteTemplate = ({ data }: { data: any }) => {
  if (!data) return <div className="p-10 text-center text-slate-400">Cargando datos...</div>;

  const fCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  const clean = (val: any) => {
    if (!val) return 'N/A';
    return typeof val === 'string' ? val.replace(/[{}"]/g, '') : val;
  };

  return (
    <div className="ff-pdf-body">
      <div className="invoice-card">
        <header className="main-header">
          <div className="brand-section">
            <div className="logo-container">
              <img src={LOGO_URL} alt="Fresh Food Panama" className="company-logo" />
            </div>
            <div className="brand-details">
              <p><strong>RUC:</strong> 155716550-2-2022-DV 25</p>
              <p>📍 Panamá, República de Panamá</p>
            </div>
          </div>
          <div className="quote-meta">
            <div className="quote-badge">PROFORMA INVOICE</div>
            <p className="ref-no"><strong>REF:</strong> {data.quote_no || 'Draft'}</p>
            <p className="date-row"><strong>DATE:</strong> {data.created_at ? new Date(data.created_at).toLocaleDateString('es-PA') : 'N/A'}</p>
          </div>
        </header>

        <div className="accent-bar" />

        <div className="details-grid">
          <div className="info-column">
            <h3 className="section-label">CUSTOMER / CONSIGNEE</h3>
            <p className="client-name">{data.client_snapshot?.name || 'Client Name'}</p>
            <p className="detail"><strong>TAX ID:</strong> {data.client_snapshot?.tax_id || 'N/A'}</p>
            <p className="detail"><strong>ADDRESS:</strong> {data.client_snapshot?.address || 'N/A'}</p>
          </div>

          <div className="info-column border-left">
            <h3 className="section-label">LOGISTICS & TERMS</h3>
            <div className="log-row"><span>INCOTERM:</span> <strong>{data.terms || 'CIP'}</strong></div>
            <div className="log-row"><span>DESTINATION:</span> <strong>{data.destination || 'N/A'}</strong></div>
            <div className="log-row"><span>MODE:</span> <strong>{data.mode?.toUpperCase() || 'AIR'}</strong></div>
          </div>
        </div>

        <div className="specs-container">
          <h3 className="section-label">PRODUCT SPECIFICATIONS</h3>
          <div className="specs-grid">
            <div className="spec-box"><span className="label">PRODUCT</span><span className="val">{data.product_details?.product_name || 'Produce'}</span></div>
            <div className="spec-box"><span className="label">VARIETY</span><span className="val">{clean(data.product_details?.variety_name)}</span></div>
            <div className="spec-box"><span className="label">CALIBER</span><span className="val">{data.product_details?.caliber || 'N/A'}</span></div>
            <div className="spec-box"><span className="label">COLOR / RIPENESS</span><span className="val">{data.product_details?.color || 'N/A'}</span></div>
          </div>
        </div>

        <table className="main-table">
          <thead>
            <tr>
              <th>DESCRIPTION</th>
              <th className="text-right">UNIT PRICE ({data.currency || 'USD'})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="desc-cell">
                <strong>Export Logistics & Fruit Supply Services</strong>
                <p className="sub-desc">Comprehensive supply chain management including harvest, packing, and international transport.</p>
              </td>
              <td className="text-right val-cell">{fCurrency(data.total)}</td>
            </tr>
          </tbody>
        </table>

        <div className="summary-footer">
          <div className="cargo-info">
            <p>QTY: <strong>{data.boxes || 0} BOXES</strong></p>
            <p>WEIGHT: <strong>{data.weight_kg || 0} KG</strong></p>
          </div>
          <div className="total-box">
            <span className="total-label">TOTAL PRICE PER BOX</span>
            <span className="total-amount">{fCurrency(data.total)}</span>
          </div>
        </div>

        <footer className="footer-legal">
          <div className="notes">
            <p><strong>Validity:</strong> 7 calendar days.</p>
            <p className="disclaimer">Subject to airline/vessel space confirmation.</p>
          </div>
          <div className="signature">
            <div className="sig-line"></div>
            <p>Authorized Signature</p>
            <p className="sig-company">Fresh Food Panama</p>
          </div>
        </footer>
      </div>

      <style>{`
        .ff-pdf-body { background: #f1f5f9; padding: 40px 20px; display: flex; justify-content: center; }
        .invoice-card { background: white; width: 21.59cm; min-height: 27.94cm; padding: 1.5cm; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; box-shadow: 0 10px 25px rgba(0,0,0,0.1); color: #1e293b; position: relative; }
        .main-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .logo-container { height: 55px; margin-bottom: 10px; }
        .company-logo { height: 100%; width: auto; object-fit: contain; }
        .brand-details p { margin: 2px 0; font-size: 11px; color: #64748b; }
        .quote-meta { text-align: right; }
        .quote-badge { background: #16a34a; color: white; padding: 5px 14px; font-weight: 800; border-radius: 6px; font-size: 12px; margin-bottom: 10px; display: inline-block; letter-spacing: 0.05em; }
        .ref-no { font-size: 14px; margin: 0; color: #1e293b; }
        .date-row { font-size: 12px; margin: 2px 0; color: #64748b; }
        .accent-bar { height: 4px; background: #16a34a; margin: 20px 0 30px 0; border-radius: 2px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 35px; }
        .section-label { font-size: 10px; color: #16a34a; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
        .client-name { font-size: 18px; font-weight: 800; margin-bottom: 8px; color: #0f172a; }
        .detail { font-size: 12px; margin: 4px 0; line-height: 1.4; }
        .log-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dashed #f1f5f9; }
        .border-left { border-left: 1px solid #f1f5f9; padding-left: 40px; }
        .specs-container { background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 35px; border: 1px solid #edf2f7; }
        .specs-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
        .spec-box { display: flex; flex-direction: column; }
        .spec-box .label { font-size: 9px; color: #94a3b8; font-weight: 800; text-transform: uppercase; }
        .spec-box .val { font-size: 13px; font-weight: 700; margin-top: 4px; color: #334155; }
        .main-table { width: 100%; border-collapse: collapse; flex-grow: 1; }
        .main-table th { text-align: left; padding: 12px 10px; border-bottom: 2px solid #16a34a; font-size: 11px; color: #16a34a; font-weight: 800; }
        .desc-cell { padding: 25px 10px !important; }
        .sub-desc { font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 400; max-width: 400px; line-height: 1.4; }
        .val-cell { font-size: 16px !important; font-weight: 700; }
        .main-table td { padding: 15px 10px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .text-right { text-align: right; }
        .summary-footer { background: #1e293b; color: white; padding: 30px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 20px -5px rgba(30, 41, 59, 0.2); }
        .cargo-info p { margin: 4px 0; font-size: 12px; opacity: 0.8; }
        .cargo-info strong { font-size: 14px; opacity: 1; }
        .total-box { text-align: right; }
        .total-label { display: block; font-size: 10px; font-weight: 800; opacity: 0.6; margin-bottom: 5px; letter-spacing: 0.1em; }
        .total-amount { font-size: 36px; font-weight: 900; color: #10b981; letter-spacing: -0.02em; }
        .footer-legal { margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; }
        .notes p { margin: 3px 0; font-size: 12px; }
        .disclaimer { color: #94a3b8; font-style: italic; }
        .signature { text-align: center; }
        .sig-line { width: 220px; border-top: 1px solid #cbd5e1; margin-bottom: 10px; }
        .signature p { margin: 2px 0; font-size: 12px; font-weight: 700; color: #1e293b; }
        .sig-company { color: #16a34a !important; font-size: 10px !important; text-transform: uppercase; }
      `}</style>
    </div>
  );
};