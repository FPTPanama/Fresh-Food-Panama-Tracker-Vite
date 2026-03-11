import React from 'react';

export const QuoteTemplate = ({ data, viewMode }: { data: any; viewMode?: string }) => {
  if (!data) return null;

  const fCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  const clean = (val: any) => {
    if (!val) return 'N/A';
    return typeof val === 'string' ? val.replace(/[{}"]/g, '') : val;
  };

  return (
    <div className="page-container">
      <div className="invoice-card">
        
        <header className="main-header">
          <div className="brand-section">
            <div className="logo-container">
              <img src="/brand/freshfood_logo.png" alt="Fresh Food Panama" className="company-logo" />
            </div>
            <div className="brand-details">
              <p><strong>RUC:</strong> 155716550-2-2022-DV 25</p>
              <p>📍 Panamá, República de Panamá</p>
            </div>
          </div>
          <div className="quote-meta">
            <div className="quote-badge">PROFORMA INVOICE</div>
            <p><strong>REF:</strong> {data.quote_no}</p>
            <p><strong>DATE:</strong> {new Date(data.created_at).toLocaleDateString('es-PA')}</p>
          </div>
        </header>

        <div className="accent-bar" />

        <div className="details-grid">
          <div className="info-column">
            <h3 className="section-label">CUSTOMER / CONSIGNATEE</h3>
            <p className="client-name">{data.client_snapshot.name}</p>
            <p className="detail"><strong>TAX ID:</strong> {data.client_snapshot.tax_id}</p>
            <p className="detail"><strong>ADDRESS:</strong> {data.client_snapshot.address}</p>
            <p className="detail"><strong>COUNTRY:</strong> {data.client_snapshot.country}</p>
          </div>

          <div className="info-column border-left">
            <h3 className="section-label">LOGISTICS & TERMS</h3>
            <div className="log-row"><span>INCOTERM:</span> <strong>{data.terms}</strong></div>
            <div className="log-row"><span>DESTINATION:</span> <strong>{data.destination}</strong></div>
            <div className="log-row"><span>MODE:</span> <strong>{data.mode.toUpperCase()}</strong></div>
            <div className="log-row"><span>PAYMENT:</span> <strong>{data.payment_terms}</strong></div>
          </div>
        </div>

        <div className="specs-container">
          <h3 className="section-label">PRODUCT SPECIFICATIONS</h3>
          <div className="specs-grid">
            <div className="spec-box"><span className="label">PRODUCT</span><span className="val">{data.product_details.name}</span></div>
            <div className="spec-box"><span className="label">VARIETY</span><span className="val">{clean(data.product_details.variety)}</span></div>
            <div className="spec-box"><span className="label">COLOR</span><span className="val">{data.product_details.color}</span></div>
            <div className="spec-box"><span className="label">BRIX</span><span className="val">{data.product_details.brix}</span></div>
          </div>
        </div>

        <table className="main-table">
          <thead>
            <tr>
              <th>DESCRIPTION</th>
              <th className="text-right">UNIT PRICE ({data.currency})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Export Logistics & Fruit Supply Services</td>
              <td className="text-right">{fCurrency(data.total)}</td>
            </tr>
          </tbody>
        </table>

        <div className="summary-footer">
          <div className="cargo-info">
            <p>QTY: <strong>{data.boxes} BOXES</strong></p>
            <p>WEIGHT: <strong>{data.weight_kg} KG</strong></p>
          </div>
          <div className="total-box">
            <span className="total-label">TOTAL PRICE PER BOX</span>
            <span className="total-amount">{fCurrency(data.total)}</span>
          </div>
        </div>

        <footer className="footer-legal">
          <div className="notes">
            <p><strong>Validity:</strong> 7 calendar days.</p>
            <p className="disclaimer">Subject to space confirmation.</p>
          </div>
          <div className="signature">
            <div className="sig-line"></div>
            <p>Fresh Food Panama</p>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .page-container { background: #f1f5f9; padding: 40px 0; display: flex; justify-content: center; }
        .invoice-card { background: white; width: 21.59cm; min-height: 27.94cm; padding: 1.5cm; font-family: sans-serif; display: flex; flex-direction: column; box-shadow: 0 10px 25px rgba(0,0,0,0.1); color: #1e293b; }
        .main-header { display: flex; justify-content: space-between; align-items: center; }
        .logo-container { height: 60px; }
        .company-logo { height: 100%; width: auto; }
        .brand-details p { margin: 2px 0; font-size: 11px; color: #64748b; }
        .quote-meta { text-align: right; }
        .quote-badge { background: #16a34a; color: white; padding: 4px 12px; font-weight: bold; border-radius: 4px; font-size: 12px; margin-bottom: 8px; }
        .accent-bar { height: 3px; background: #16a34a; margin: 15px 0 25px 0; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
        .section-label { font-size: 10px; color: #16a34a; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; margin-bottom: 10px; font-weight: bold; text-transform: uppercase; }
        .client-name { font-size: 18px; font-weight: bold; margin-bottom: 8px; }
        .detail { font-size: 12px; margin: 3px 0; }
        .log-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; }
        .border-left { border-left: 1px solid #f1f5f9; padding-left: 40px; }
        .specs-container { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #edf2f7; }
        .specs-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
        .spec-box { display: flex; flex-direction: column; }
        .spec-box .label { font-size: 9px; color: #94a3b8; font-weight: bold; }
        .spec-box .val { font-size: 13px; font-weight: bold; margin-top: 2px; }
        .main-table { width: 100%; border-collapse: collapse; flex-grow: 1; }
        .main-table th { text-align: left; padding: 10px; border-bottom: 2px solid #16a34a; font-size: 11px; color: #16a34a; }
        .main-table td { padding: 15px 10px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .text-right { text-align: right; }
        .summary-footer { background: #1e293b; color: white; padding: 25px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
        .total-amount { font-size: 34px; font-weight: bold; color: #10b981; }
        .footer-legal { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
        .sig-line { width: 180px; border-top: 1px solid #cbd5e1; margin-bottom: 5px; }
        @media print {
          .page-container { padding: 0; background: white; }
          .invoice-card { box-shadow: none; width: 100%; height: 100%; padding: 1cm; }
          .summary-footer { -webkit-print-color-adjust: exact; background-color: #1e293b !important; }
        }
      `}</style>
    </div>
  );
};