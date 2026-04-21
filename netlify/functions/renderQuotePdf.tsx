import type { Handler } from "@netlify/functions";
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToStream, Image } from '@react-pdf/renderer';
import path from 'path';
import { sbAdmin, optionsResponse, text, commonHeaders } from "./_util";

const COLORS = {
  PRIMARY: '#065f46',      
  PRIMARY_LIGHT: '#10b981', 
  ACCENT: '#d97706',        
  TEXT_MAIN: '#1e293b',     
  TEXT_LIGHT: '#64748b',    
  BG_SOFT: '#f8fafc',       
  BORDER: '#e2e8f0'         
};

const styles = StyleSheet.create({
  page: { padding: '15mm', fontFamily: 'Helvetica', fontSize: 9, color: COLORS.TEXT_MAIN, backgroundColor: '#FFFFFF', position: 'relative' },
  
  // --- HEADER HORIZONTAL COMPACTO ---
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2 solid ${COLORS.PRIMARY_LIGHT}`, paddingBottom: 12, marginBottom: 15 },
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
  
  // --- CUERPO DEL DOCUMENTO ---
  gridContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  gridCol: { flex: 1, padding: 12, border: `1 solid ${COLORS.BORDER}`, borderRadius: 6 },
  sectionLabel: { fontSize: 7, fontWeight: 'bold', color: COLORS.PRIMARY_LIGHT, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, borderBottom: `1 solid ${COLORS.BG_SOFT}`, paddingBottom: 3 },
  clientName: { fontSize: 10, fontWeight: 'bold', color: COLORS.TEXT_MAIN, textTransform: 'uppercase', marginBottom: 4 },
  gridText: { fontSize: 8, color: '#475569', lineHeight: 1.5 },
  paymentTermsBox: { marginTop: 6, paddingTop: 6, borderTop: `1 dotted ${COLORS.BORDER}` },
  
  techGrid: { flexDirection: 'row', backgroundColor: COLORS.BG_SOFT, border: `1 solid ${COLORS.BORDER}`, borderRadius: 6, marginBottom: 15, padding: 10 },
  techItem: { flex: 1, borderRight: `1 solid ${COLORS.BORDER}`, paddingHorizontal: 8 },
  techItemLast: { flex: 1, paddingHorizontal: 8 },
  techLabel: { fontSize: 6, color: COLORS.TEXT_LIGHT, textTransform: 'uppercase', marginBottom: 2, fontWeight: 'bold' },
  techValue: { fontSize: 9, fontWeight: 'bold', color: COLORS.ACCENT },
  
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.TEXT_MAIN, padding: 8, borderRadius: 4, marginBottom: 5 },
  th: { fontSize: 7, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: 8, borderBottom: `1 solid ${COLORS.BG_SOFT}`, alignItems: 'center' },
  prodName: { fontSize: 9, fontWeight: 'bold', color: COLORS.TEXT_MAIN, textTransform: 'uppercase' },
  
  // --- FOOTER ---
  footerSection: { position: 'absolute', bottom: '15mm', left: '15mm', right: '15mm' },
  footerTop: { flexDirection: 'row', justifyContent: 'space-between', borderTop: `1 solid ${COLORS.BORDER}`, paddingTop: 12 },
  infoBlocksContainer: { width: '60%', flexDirection: 'column', gap: 10 },
  bankBox: { backgroundColor: COLORS.BG_SOFT, padding: 8, borderRadius: 6, border: `1 solid ${COLORS.BORDER}` },
  bankTitle: { fontSize: 7, fontWeight: 'bold', color: COLORS.PRIMARY, textTransform: 'uppercase', marginBottom: 4 },
  bankText: { fontSize: 6.5, color: COLORS.TEXT_MAIN, lineHeight: 1.3 },
  bankLabel: { color: COLORS.TEXT_LIGHT },
  intermediaryBox: { marginTop: 6, paddingTop: 6, borderTop: `1 dashed ${COLORS.BORDER}` },
  
  termsBox: { padding: 4 },
  termsTitle: { fontSize: 7, fontWeight: 'bold', color: COLORS.PRIMARY, textTransform: 'uppercase', marginBottom: 2 },
  termsText: { fontSize: 6.5, color: COLORS.TEXT_LIGHT, lineHeight: 1.3, fontStyle: 'italic' },
  
  totalContainer: { textAlign: 'right', backgroundColor: COLORS.PRIMARY, padding: 12, borderRadius: 8, minWidth: 150, alignSelf: 'flex-start' },
  totalLabel: { fontSize: 7, fontWeight: 'bold', color: COLORS.PRIMARY_LIGHT, textTransform: 'uppercase', marginBottom: 2 },
  totalAmount: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  signatureRow: { marginTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
});

const PdfTemplate = ({ data, company, brandDir }: { data: any, company: any, brandDir: string }) => {
  const masterRaw = data.clients || {};
  const master = Array.isArray(masterRaw) ? masterRaw[0] : (masterRaw || {});
  const snapshot = data.client_snapshot || {};
  const bank = company.bank_details || {};

  const finalTotal = data.totals?.grand_total || data.totals?.total || data.total_amount || 0;
  const totalBoxes = data.boxes || 0;
  const unitPrice = totalBoxes > 0 ? (finalTotal / totalBoxes) : 0;
  const totalWeight = data.weight_kg || data.total_weight || 0;
  const totalPallets = data.totals?.meta?.pallets || 0;

  const specs = data.product_details || {};
  const prodRel = Array.isArray(data.products) ? data.products[0] : (data.products || {});
  const productName = prodRel.name || specs.product_name || specs.name || "Producto Fresco";
  const variety = specs.variety || prodRel.variety || "N/A";
  const caliber = specs.caliber || specs.size || "-";
  const color = specs.color || specs.fruit_color || prodRel.default_color || "-";
  const brix = specs.brix || specs.sugar_content || prodRel.default_brix || "-";

  const productLabel = variety !== "N/A" ? `${productName} - Variedad: ${variety}` : productName;
  const incoterm = data.totals?.meta?.incoterm || master.default_incoterm || "FOB";

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const cleanDate = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00Z`;
    const d = new Date(cleanDate);
    return d.toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Recuperamos las líneas dinámicas generadas en el cotizador
  const quoteItems = data.totals?.items || [];

  return (
    <Document title={`Cotizacion_${data.quote_number}`}>
      <Page size="LETTER" style={styles.page}>
        
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src={path.join(brandDir, 'freshfood_logo.png')} style={styles.logo} />
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{company.legal_name || company.trade_name}</Text>
              <Text style={styles.companyText}><Text style={styles.labelBold}>RUC / TAX ID: </Text>{company.tax_id}</Text>
              <Text style={styles.companyText}><Text style={styles.labelBold}>Dirección: </Text>{company.address}</Text>
              <Text style={styles.companyText}><Text style={styles.labelBold}>Email: </Text>{company.contact_email}</Text>
              {company.website ? <Text style={styles.companyText}><Text style={styles.labelBold}>Web: </Text>{company.website}</Text> : null}
            </View>
          </View>
          
          <View style={styles.headerRight}>
            <Text style={styles.headerTitle}>Cotización</Text>
            <Text style={styles.quoteCode}>#{data.quote_number || 'BORRADOR'}</Text>
            <View style={styles.dates}>
              <Text><Text style={styles.labelBold}>Emisión: </Text>{formatDate(data.created_at)}</Text>
              <Text style={{ color: COLORS.ACCENT }}>
                <Text style={{ fontWeight: 'bold' }}>Válido hasta: </Text>
                {data.valid_until ? formatDate(data.valid_until) : 'Sujeto a cambios'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.gridContainer}>
          <View style={styles.gridCol}>
            <Text style={styles.sectionLabel}>Consignatario / Importador</Text>
            <Text style={styles.clientName}>{master.name || snapshot.name || "CLIENTE N/A"}</Text>
            <View style={styles.gridText}>
              <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{master.legal_name || snapshot.legal_name || "Razón Social no definida"}</Text>
              <Text>ID Fiscal: {master.tax_id || snapshot.tax_id || "SIN TAX ID"}</Text>
              <Text>Dirección: {master.address || snapshot.address || "Dirección no definida"}</Text>
            </View>
          </View>
          
          <View style={styles.gridCol}>
            <Text style={styles.sectionLabel}>Logística y Términos Comerciales</Text>
            <View style={styles.gridText}>
              <Text>Incoterm: {incoterm}</Text>
              <Text>Modo: {data.mode === 'AIR' ? 'Carga Aérea' : 'Carga Marítima'}</Text>
              <Text>Destino: {data.destination}</Text>
              {specs.requested_shipment_date ? <Text>ETD Estimado: {formatDate(specs.requested_shipment_date)}</Text> : null}
              
              <View style={styles.paymentTermsBox}>
                <Text>
                  <Text style={{ fontWeight: 'bold', color: COLORS.PRIMARY }}>Condiciones de Pago: </Text>
                  <Text style={{ color: COLORS.TEXT_MAIN }}>{data.payment_terms || "A convenir entre las partes"}</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Especificaciones de Calidad y Carga</Text>
        <View style={styles.techGrid}>
          <View style={[styles.techItem, { flex: 1.2 }]}>
            <Text style={styles.techLabel}>Producto</Text>
            <Text style={styles.techValue}>{productName}</Text>
          </View>
          <View style={[styles.techItem, { flex: 1.2 }]}>
            <Text style={styles.techLabel}>Variedad</Text>
            <Text style={styles.techValue}>{variety}</Text>
          </View>
          <View style={[styles.techItem, { flex: 1.6 }]}>
            <Text style={styles.techLabel}>Color / Tamaño / Brix</Text>
            <Text style={styles.techValue}>{color} / {caliber} / {brix}</Text>
          </View>
          <View style={[styles.techItem, { flex: 0.8 }]}>
            <Text style={styles.techLabel}>Pallets</Text>
            <Text style={styles.techValue}>{totalPallets}</Text>
          </View>
          <View style={styles.techItemLast}>
            <Text style={styles.techLabel}>Peso Estimado</Text>
            <Text style={styles.techValue}>{Number(totalWeight).toLocaleString()} kg</Text>
          </View>
        </View>

        {/* TABLA DE PRODUCTOS Y RECARGOS (RENDERIZADO DINÁMICO) */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2.5 }]}>Concepto / Servicio</Text>
          <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>Cant.</Text>
          <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Precio Unit.</Text>
          <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Subtotal (USD)</Text>
        </View>

        {quoteItems.length > 0 ? (
          /* Mapeo dinámico de todas las líneas que tengan un total > 0 */
          quoteItems.map((item: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <View style={{ flex: 2.5 }}>
                <Text style={styles.prodName}>{item.name}</Text>
              </View>
              <Text style={{ flex: 0.8, textAlign: 'center' }}>
                {item.qty || 1}
              </Text>
              <Text style={{ flex: 1.2, textAlign: 'right' }}>
                $ {Number(item.unit || item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', color: COLORS.PRIMARY }}>
                $ {Number(item.totalRow || item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          ))
        ) : (
          /* Fallback para cotizaciones antiguas que no tienen el array de items guardado */
          <View style={styles.tableRow}>
            <View style={{ flex: 2.5 }}><Text style={styles.prodName}>{productLabel}</Text></View>
            <Text style={{ flex: 0.8, textAlign: 'center' }}>{totalBoxes}</Text>
            <Text style={{ flex: 1.2, textAlign: 'right' }}>$ {unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <Text style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', color: COLORS.PRIMARY }}>$ {Number(finalTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </View>
        )}

        <View style={styles.footerSection}>
          <View style={styles.footerTop}>
            <View style={styles.infoBlocksContainer}>
              <View style={styles.bankBox}>
                <Text style={styles.bankTitle}>Instrucciones de Pago (Transferencia Bancaria)</Text>
                <Text style={styles.bankText}><Text style={styles.bankLabel}>Beneficiario: </Text><Text style={{fontWeight: 'bold'}}>{bank.beneficiary || company.legal_name}</Text></Text>
                {bank.beneficiary_address ? <Text style={styles.bankText}><Text style={styles.bankLabel}>Dirección: </Text>{bank.beneficiary_address}</Text> : null}
                <Text style={styles.bankText}><Text style={styles.bankLabel}>Banco: </Text>{bank.bank_name || bank.bank || "N/A"}</Text>
                {bank.bank_address ? <Text style={styles.bankText}><Text style={styles.bankLabel}>Dir. del Banco: </Text>{bank.bank_address}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 15, marginTop: 2 }}>
                  <Text style={styles.bankText}><Text style={styles.bankLabel}>Cuenta (USD): </Text><Text style={{fontWeight: 'bold'}}>{bank.account_number || bank.account || "N/A"}</Text></Text>
                  {bank.account_type ? <Text style={styles.bankText}><Text style={styles.bankLabel}>Tipo: </Text>{bank.account_type}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 15 }}>
                  <Text style={styles.bankText}><Text style={styles.bankLabel}>SWIFT / BIC: </Text><Text style={{fontWeight: 'bold'}}>{bank.swift_bic || bank.swift || "N/A"}</Text></Text>
                  {bank.routing_aba ? <Text style={styles.bankText}><Text style={styles.bankLabel}>ABA: </Text>{bank.routing_aba}</Text> : null}
                </View>

                {bank.intermediary_bank_name ? (
                  <View style={styles.intermediaryBox}>
                    <Text style={[styles.bankTitle, { fontSize: 6.5, marginBottom: 2 }]}>Banco Intermediario / Corresponsal</Text>
                    <Text style={styles.bankText}><Text style={styles.bankLabel}>Banco: </Text>{bank.intermediary_bank_name}</Text>
                    {bank.intermediary_bank_address ? <Text style={styles.bankText}><Text style={styles.bankLabel}>Dirección: </Text>{bank.intermediary_bank_address}</Text> : null}
                    <View style={{ flexDirection: 'row', gap: 15, marginTop: 2 }}>
                      {bank.intermediary_swift ? <Text style={styles.bankText}><Text style={styles.bankLabel}>SWIFT: </Text><Text style={{fontWeight: 'bold'}}>{bank.intermediary_swift}</Text></Text> : null}
                      {bank.intermediary_aba ? <Text style={styles.bankText}><Text style={styles.bankLabel}>ABA / Routing: </Text><Text style={{fontWeight: 'bold'}}>{bank.intermediary_aba}</Text></Text> : null}
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.termsBox}>
                <Text style={styles.termsTitle}>Términos y Condiciones</Text>
                <Text style={styles.termsText}>
                  {data.terms || company.terms_and_conditions || "Sujeto a disponibilidad de espacio y confirmación de reserva. Los precios y fletes están sujetos a cambios por fluctuaciones del mercado."}
                </Text>
              </View>
            </View>

            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total a Pagar (USD)</Text>
              <Text style={styles.totalAmount}>$ {Number(finalTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>

          </View>
          
          <View style={styles.signatureRow}>
            <Text style={{ fontSize: 7, color: COLORS.TEXT_LIGHT }}>Documento oficial generado de forma automatizada por el sistema de FreshConnect.</Text>
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

    const [quoteRes, companyRes] = await Promise.all([
      sbAdmin.from("quotes").select("*, clients(*), products(*)").eq("id", id).maybeSingle(),
      sbAdmin.from("company_profile").select("*").limit(1).maybeSingle()
    ]);

    if (quoteRes.error || !quoteRes.data) return text(404, "Cotización no encontrada");
    if (!companyRes.data) return text(500, "Perfil de empresa no configurado");

    const brandDir = path.join(process.cwd(), "public", "brand");
    const stream = await renderToStream(<PdfTemplate data={quoteRes.data} company={companyRes.data} brandDir={brandDir} />);
    const chunks: any[] = [];
    for await (const chunk of stream) { chunks.push(chunk); }

    const safeQuoteNumber = quoteRes.data.quote_number || 'Borrador';
    const fileName = `Cotizacion Fresh Food Panama ${safeQuoteNumber}.pdf`;

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