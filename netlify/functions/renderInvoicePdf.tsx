// @ts-nocheck
import type { Handler } from "@netlify/functions";
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToStream, Image } from '@react-pdf/renderer';
import path from 'path';
import { sbAdmin, optionsResponse, text, commonHeaders } from "./_util";

const COLORS = {
  PRIMARY: '#1e293b',
  PRIMARY_LIGHT: '#3b82f6',
  ACCENT: '#ef4444',
  TEXT_MAIN: '#0f172a',     
  TEXT_LIGHT: '#64748b',    
  BG_SOFT: '#f8fafc',       
  BORDER: '#e2e8f0',
  SUCCESS: '#10b981'
};

const styles = StyleSheet.create({
  page: { padding: '15mm', fontFamily: 'Helvetica', fontSize: 9, color: COLORS.TEXT_MAIN, backgroundColor: '#FFFFFF', position: 'relative' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 2, borderBottomColor: COLORS.PRIMARY_LIGHT, borderBottomStyle: 'solid', paddingBottom: 12, marginBottom: 15 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', width: '65%' },
  logo: { width: 110, marginRight: 15 },
  companyInfo: { display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1 },
  companyName: { fontWeight: 'bold', color: COLORS.PRIMARY, fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
  companyText: { fontSize: 7.5, color: COLORS.TEXT_LIGHT },
  labelBold: { fontWeight: 'bold', color: COLORS.TEXT_MAIN },
  
  headerRight: { width: '35%', textAlign: 'right' },
  headerTitle: { fontSize: 6, fontWeight: 'bold', color: COLORS.PRIMARY_LIGHT, textTransform: 'uppercase', letterSpacing: 1 },
  quoteCode: { fontSize: 16, fontWeight: 'bold', color: COLORS.TEXT_MAIN, marginTop: 4 },
  dates: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 8 },
  
  gridContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  gridCol: { flex: 1, padding: 12, borderWidth: 1, borderStyle: 'solid', borderColor: COLORS.BORDER, borderRadius: 6, backgroundColor: COLORS.BG_SOFT },
  sectionLabel: { fontSize: 7, fontWeight: 'bold', color: COLORS.PRIMARY_LIGHT, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: COLORS.BORDER, paddingBottom: 3 },
  clientName: { fontSize: 10, fontWeight: 'bold', color: COLORS.TEXT_MAIN, textTransform: 'uppercase', marginBottom: 4 },
  gridText: { fontSize: 8, color: '#475569', lineHeight: 1.5 },
  
  techGrid: { flexDirection: 'row', borderWidth: 1, borderStyle: 'solid', borderColor: COLORS.BORDER, borderRadius: 6, marginBottom: 15, padding: 8, backgroundColor: COLORS.BG_SOFT },
  techItem: { flex: 1, borderRightWidth: 1, borderRightStyle: 'solid', borderRightColor: COLORS.BORDER, paddingHorizontal: 5 },
  techItemLast: { flex: 1, paddingHorizontal: 5 },
  techLabel: { fontSize: 6, color: COLORS.TEXT_LIGHT, textTransform: 'uppercase', marginBottom: 2 },
  techValue: { fontSize: 8, fontWeight: 'bold' },

  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.PRIMARY, padding: 8, borderRadius: 4, marginBottom: 5 },
  th: { fontSize: 7, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: COLORS.BG_SOFT, alignItems: 'center' },
  prodName: { fontSize: 9, fontWeight: 'bold', color: COLORS.TEXT_MAIN },
  
  footerSection: { position: 'absolute', bottom: '15mm', left: '15mm', right: '15mm' },
  footerTop: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: COLORS.BORDER, paddingTop: 12 },
  infoBlocksContainer: { width: '55%', flexDirection: 'column', gap: 10 },
  bankBox: { backgroundColor: COLORS.BG_SOFT, padding: 8, borderRadius: 6, borderWidth: 1, borderStyle: 'solid', borderColor: COLORS.BORDER },
  bankTitle: { fontSize: 7, fontWeight: 'bold', color: COLORS.PRIMARY, textTransform: 'uppercase', marginBottom: 4 },
  bankText: { fontSize: 6.5, color: COLORS.TEXT_MAIN, lineHeight: 1.3 },
  bankLabel: { color: COLORS.TEXT_LIGHT },
  
  termsBox: { padding: 4 },
  termsTitle: { fontSize: 7, fontWeight: 'bold', color: COLORS.PRIMARY, textTransform: 'uppercase', marginBottom: 2 },
  termsText: { fontSize: 6.5, color: COLORS.TEXT_LIGHT, lineHeight: 1.3, fontStyle: 'italic' },
  
  financialBox: { width: '40%', borderWidth: 1, borderStyle: 'solid', borderColor: COLORS.BORDER, borderRadius: 6, padding: 10, backgroundColor: '#ffffff' },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  finLabel: { fontSize: 8, color: COLORS.TEXT_LIGHT },
  finValue: { fontSize: 9, fontWeight: 'bold', color: COLORS.TEXT_MAIN },
  finDivider: { borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: COLORS.BORDER, marginVertical: 6 },
  
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.BG_SOFT, padding: 8, borderRadius: 4, marginTop: 4 },
  balanceLabel: { fontSize: 8, fontWeight: 'bold', color: COLORS.PRIMARY, textTransform: 'uppercase' },
  balanceAmount: { fontSize: 16, fontWeight: 'bold', color: COLORS.ACCENT },
  balanceAmountPaid: { fontSize: 16, fontWeight: 'bold', color: COLORS.SUCCESS },
  
  signatureRow: { marginTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  statusStamp: { borderWidth: 2, borderStyle: 'solid', borderColor: COLORS.SUCCESS, padding: 6, borderRadius: 4, width: 140, textAlign: 'center', opacity: 0.8 },
  stampText: { color: COLORS.SUCCESS, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
});

const PdfTemplate = ({ data, company, brandDir }: { data: any, company: any, brandDir: string }) => {
  
  const clientRaw = data.clients || {};
  const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;

  // Extracción de la cotización vinculada
  const quoteRaw = data.quotes || {};
  const quote = Array.isArray(quoteRaw) ? quoteRaw[0] : quoteRaw;
  
  // --- HOMOLOGACIÓN CON ORDEN DE COMPRA ---
  const specs = quote.product_details || {};
  const prodRel = Array.isArray(quote.products) ? quote.products[0] : (quote.products || {});
  
  const productName = prodRel.name || specs.product_name || specs.name || "Producto Fresco";
  const variety = specs.variety || prodRel.variety || "N/A";
  const caliber = specs.caliber || specs.size || "N/A";
  const color = specs.color || specs.fruit_color || "N/A";
  const brix = specs.brix || specs.sugar_content || "N/A";

  const productLabel = variety !== "N/A" ? `${productName} - Variedad: ${variety}` : productName;

  const incoterm = quote.totals?.meta?.incoterm || "CIP";
  const mode = quote.mode === 'AIR' ? 'AÉREO' : (quote.mode === 'OCEAN' ? 'MARÍTIMO' : quote.mode || "N/A");
  const destination = quote.destination || "N/A";
  const etd = specs.requested_shipment_date;

  const bank = company.bank_details || {};
  const finalTotal = Number(data.total) || 0;
  const amountPaid = Number(data.amount_paid) || 0;
  const balanceDue = Math.max(0, finalTotal - amountPaid);
  const isPaid = data.status === 'PAID' || balanceDue <= 0;

  // 💡 LÓGICA ROBUSTA Y SEGURA DE EXTRACCIÓN DE ITEMS (Evita Crashes y Permite Descuentos)
  let rawItems = [];
  
  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    rawItems = data.items;
  } else if (quote.totals?.items && Array.isArray(quote.totals.items) && quote.totals.items.length > 0) {
    rawItems = quote.totals.items;
  }

  // Sanitización estricta de cada línea
  let printableItems = rawItems.map((item: any) => {
    // Evitar que el 0 se convierta en 1 por error de falsy.
    const qty = (item.qty !== undefined && item.qty !== null && item.qty !== "") ? Number(item.qty) : 1;
    const unitPrice = Number(item.unit) || Number(item.price) || 0;
    const totalRow = (item.totalRow !== undefined && item.totalRow !== null) ? Number(item.totalRow) : (qty * unitPrice);

    return {
      name: item.name || item.description || item.concepto || item.label || `Exportación: ${productLabel}`,
      qty: qty,
      unit: unitPrice,
      totalRow: totalRow
    };
  }).filter(item => {
    // CORRECCIÓN CLAVE: Aceptar valores negativos (descuentos) y filas con texto válido aunque valgan $0
    return item.totalRow !== 0 || item.unit !== 0 || (item.name && item.name.trim() !== "");
  });

  // Fallback Definitivo si no hay items pero sí hay un total cobrado
  if (printableItems.length === 0 && finalTotal !== 0) {
    printableItems = [{
      name: `Exportación General: ${productLabel}`,
      qty: data.boxes || quote.boxes || 1,
      unit: finalTotal / (data.boxes || quote.boxes || 1),
      totalRow: finalTotal
    }];
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const cleanDate = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00Z`;
    const d = new Date(cleanDate);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  return (
    <Document title={`Invoice_${data.invoice_number}`}>
      <Page size="LETTER" style={styles.page}>
        
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src={path.join(brandDir, 'freshfood_logo.png')} style={styles.logo} />
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{company.legal_name || company.trade_name}</Text>
              <Text style={styles.companyText}><Text style={styles.labelBold}>TAX ID: </Text>{company.tax_id || "N/A"}</Text>
              <Text style={styles.companyText}><Text style={styles.labelBold}>Address: </Text>{company.address || "N/A"}</Text>
              <Text style={styles.companyText}><Text style={styles.labelBold}>Email: </Text>{company.contact_email || "N/A"}</Text>
            </View>
          </View>
          
          <View style={styles.headerRight}>
            <Text style={styles.headerTitle}>Commercial Invoice</Text>
            <Text style={styles.quoteCode}>{data.invoice_number}</Text>
            <View style={styles.dates}>
              <Text><Text style={styles.labelBold}>Issue Date: </Text>{formatDate(data.issue_date)}</Text>
              <Text style={{ color: isPaid ? COLORS.SUCCESS : COLORS.ACCENT, fontWeight: 'bold' }}>
                <Text style={styles.labelBold}>Due Date: </Text>{formatDate(data.due_date)}
              </Text>
              
              {quote.quote_number ? (
                <Text style={{ marginTop: 2, color: COLORS.TEXT_LIGHT }}>Ref Quote: {quote.quote_number}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.gridContainer}>
          <View style={styles.gridCol}>
            <Text style={styles.sectionLabel}>Billed To / Consignee</Text>
            <Text style={styles.clientName}>{client.name || "CLIENT"}</Text>
            <View style={styles.gridText}>
              <Text>Tax ID: {client.tax_id || "N/A"}</Text>
              <Text>Address: {client.address || "N/A"}</Text>
              <Text>Contact: {client.contact_name || "N/A"} ({client.email || client.contact_email || "N/A"})</Text>
            </View>
          </View>

          <View style={[styles.gridCol, { backgroundColor: '#ffffff' }]}>
            <Text style={styles.sectionLabel}>Shipping & Commercial Terms</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              <View style={{ width: '48%' }}><Text style={styles.techLabel}>INCOTERM</Text><Text style={{ fontSize: 8, fontWeight: 'bold' }}>{incoterm} 2020</Text></View>
              <View style={{ width: '48%' }}><Text style={styles.techLabel}>MODE</Text><Text style={{ fontSize: 8, fontWeight: 'bold' }}>{mode}</Text></View>
              <View style={{ width: '48%' }}><Text style={styles.techLabel}>DESTINATION</Text><Text style={{ fontSize: 8, fontWeight: 'bold' }}>{destination}</Text></View>
              <View style={{ width: '48%' }}><Text style={styles.techLabel}>EST. DEPARTURE</Text><Text style={{ fontSize: 8, fontWeight: 'bold' }}>{formatDate(etd)}</Text></View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Product Specifications</Text>
        <View style={styles.techGrid}>
          <View style={styles.techItem}><Text style={styles.techLabel}>Product</Text><Text style={styles.techValue}>{productName}</Text></View>
          <View style={styles.techItem}><Text style={styles.techLabel}>Variety</Text><Text style={styles.techValue}>{variety}</Text></View>
          <View style={styles.techItem}><Text style={styles.techLabel}>Caliber / Size</Text><Text style={styles.techValue}>{caliber}</Text></View>
          <View style={styles.techItem}><Text style={styles.techLabel}>Color</Text><Text style={styles.techValue}>{color}</Text></View>
          <View style={styles.techItemLast}><Text style={styles.techLabel}>Brix / Sugar</Text><Text style={styles.techValue}>{brix}</Text></View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2.5 }]}>Description / Concept</Text>
          <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>Qty</Text>
          <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Unit Price</Text>
          <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Total (USD)</Text>
        </View>

        {printableItems.length > 0 ? (
          printableItems.map((item: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <View style={{ flex: 2.5 }}><Text style={styles.prodName}>{item.name}</Text></View>
              <Text style={{ flex: 0.8, textAlign: 'center' }}>{item.qty}</Text>
              <Text style={{ flex: 1.2, textAlign: 'right', color: item.unit < 0 ? COLORS.ACCENT : COLORS.TEXT_MAIN }}>
                $ {item.unit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', color: item.totalRow < 0 ? COLORS.ACCENT : COLORS.TEXT_MAIN }}>
                $ {item.totalRow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.tableRow}>
             <Text style={{ flex: 1, textAlign: 'center', color: COLORS.TEXT_LIGHT }}>Sin conceptos facturables.</Text>
          </View>
        )}

        <View style={styles.footerSection}>
          <View style={styles.footerTop}>
            
            <View style={styles.infoBlocksContainer}>
              <View style={styles.bankBox}>
                <Text style={styles.bankTitle}>Payment Instructions (Wire Transfer)</Text>
                <Text style={styles.bankText}><Text style={styles.bankLabel}>Beneficiary: </Text><Text style={{fontWeight: 'bold'}}>{bank.beneficiary || company.legal_name}</Text></Text>
                <Text style={styles.bankText}><Text style={styles.bankLabel}>Bank Name: </Text>{bank.bank_name || bank.bank || "N/A"}</Text>
                <View style={{ flexDirection: 'row', gap: 15, marginTop: 2 }}>
                  <Text style={styles.bankText}><Text style={styles.bankLabel}>Account (USD): </Text><Text style={{fontWeight: 'bold'}}>{bank.account_number || bank.account || "N/A"}</Text></Text>
                  {bank.account_type ? <Text style={styles.bankText}><Text style={styles.bankLabel}>Type: </Text>{bank.account_type}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 15 }}>
                  <Text style={styles.bankText}><Text style={styles.bankLabel}>SWIFT / BIC: </Text><Text style={{fontWeight: 'bold'}}>{bank.swift_bic || bank.swift || "N/A"}</Text></Text>
                  {bank.routing_aba ? <Text style={styles.bankText}><Text style={styles.bankLabel}>Routing/ABA: </Text>{bank.routing_aba}</Text> : null}
                </View>
              </View>

              {data.notes ? (
                <View style={styles.termsBox}>
                  <Text style={styles.termsTitle}>Invoice Notes</Text>
                  <Text style={styles.termsText}>{data.notes}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.financialBox}>
              <View style={styles.finRow}>
                <Text style={styles.finLabel}>Subtotal</Text>
                <Text style={styles.finValue}>$ {Number(data.subtotal || finalTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </View>
              
              {Number(data.tax_amount) > 0 ? (
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>Tax / ITBMS</Text>
                  <Text style={styles.finValue}>$ {Number(data.tax_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </View>
              ) : null}
              
              <View style={styles.finDivider} />
              
              <View style={styles.finRow}>
                <Text style={styles.finLabel}>Total Invoice</Text>
                <Text style={styles.finValue}>$ {finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={styles.finRow}>
                <Text style={styles.finLabel}>Amount Paid</Text>
                <Text style={styles.finValue}>-$ {amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </View>

              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Balance Due</Text>
                <Text style={isPaid ? styles.balanceAmountPaid : styles.balanceAmount}>
                  $ {balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

          </View>
          
          <View style={styles.signatureRow}>
            <Text style={{ fontSize: 7, color: COLORS.TEXT_LIGHT }}>Document generated automatically by FreshConnect. Subject to terms of service.</Text>
            
            {isPaid ? (
              <View style={styles.statusStamp}>
                <Text style={styles.stampText}>PAID IN FULL</Text>
              </View>
            ) : null}
          </View>
        </View>

      </Page>
    </Document>
  );
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  try {
    const id = event.queryStringParameters?.id;
    if (!id) return text(400, "ID requerido");

    const [invoiceRes, companyRes] = await Promise.all([
      sbAdmin.from("invoices")
        .select("*, clients(*), quotes(*, products(*))")
        .eq("id", id)
        .maybeSingle(),
      sbAdmin.from("company_profile").select("*").limit(1).maybeSingle()
    ]);

    if (invoiceRes.error || !invoiceRes.data) return text(404, "Factura no encontrada");
    if (!companyRes.data) return text(500, "Perfil de empresa no configurado");

    const brandDir = path.join(process.cwd(), "public", "brand");
    const stream = await renderToStream(<PdfTemplate data={invoiceRes.data} company={companyRes.data} brandDir={brandDir} />);
    const chunks: any[] = [];
    for await (const chunk of stream) { chunks.push(chunk); }

    const fileName = `Invoice Fresh Food Panama ${invoiceRes.data.invoice_number}.pdf`;

    return {
      statusCode: 200,
      headers: { 
        ...commonHeaders, 
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`
      },
      body: Buffer.concat(chunks).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err: any) {
    return text(500, `Error: ${err.message}`);
  }
};