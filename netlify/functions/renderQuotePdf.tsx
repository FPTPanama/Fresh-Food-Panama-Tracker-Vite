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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2 solid ${COLORS.PRIMARY_LIGHT}`, paddingBottom: 15, marginBottom: 20 },
  logo: { width: 140, marginBottom: 5 },
  companyInfo: { fontSize: 8, color: COLORS.TEXT_LIGHT, lineHeight: 1.2 },
  companyName: { fontWeight: 'bold', color: COLORS.PRIMARY, fontSize: 10 },
  headerRight: { textAlign: 'right' },
  headerTitle: { fontSize: 9, fontWeight: 'bold', color: COLORS.PRIMARY_LIGHT, textTransform: 'uppercase', letterSpacing: 1 },
  quoteCode: { fontSize: 16, fontWeight: 'bold', color: COLORS.TEXT_MAIN, marginTop: 5 },
  dates: { marginTop: 8, fontSize: 8 },
  gridContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  gridCol: { flex: 1, padding: 12, border: `1 solid ${COLORS.BORDER}`, borderRadius: 6 },
  sectionLabel: { fontSize: 7, fontWeight: 'bold', color: COLORS.PRIMARY_LIGHT, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, borderBottom: `1 solid ${COLORS.BG_SOFT}`, paddingBottom: 2 },
  clientName: { fontSize: 10, fontWeight: 'bold', color: COLORS.TEXT_MAIN, textTransform: 'uppercase', marginBottom: 3 },
  gridText: { fontSize: 8, color: '#475569', lineHeight: 1.4 },
  techGrid: { flexDirection: 'row', backgroundColor: COLORS.BG_SOFT, border: `1 solid ${COLORS.BORDER}`, borderRadius: 6, marginBottom: 20, padding: 10 },
  techItem: { flex: 1, borderRight: `1 solid ${COLORS.BORDER}`, paddingHorizontal: 8 },
  techItemLast: { flex: 1, paddingHorizontal: 8 },
  techLabel: { fontSize: 6, color: COLORS.TEXT_LIGHT, textTransform: 'uppercase', marginBottom: 2, fontWeight: 'bold' },
  techValue: { fontSize: 9, fontWeight: 'bold', color: COLORS.ACCENT },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.TEXT_MAIN, padding: 8, borderRadius: 4, marginBottom: 5 },
  th: { fontSize: 7, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: 8, borderBottom: `1 solid ${COLORS.BG_SOFT}`, alignItems: 'center' },
  prodName: { fontSize: 9, fontWeight: 'bold', color: COLORS.TEXT_MAIN, textTransform: 'uppercase' },
  
  // Footer y Secciones Bancarias
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
  // Manejo seguro de objetos
  const masterRaw = data.clients || {};
  const master = Array.isArray(masterRaw) ? masterRaw[0] : (masterRaw || {});
  const snapshot = data.client_snapshot || {};
  const bank = company.bank_details || {};

  // Cálculos Financieros
  const finalTotal = data.totals?.grand_total || data.totals?.total || data.total_amount || 0;
  const totalBoxes = data.boxes || 0;
  const unitPrice = totalBoxes > 0 ? (finalTotal / totalBoxes) : 0;
  const totalWeight = data.weight_kg || data.total_weight || 0;

  // Extracción robusta de Producto (Relación SQL) y Especificaciones (JSON)
  const specs = data.product_details || {};
  const productName = data.products?.name || "Producto Fresco";
  const variety = specs.variety || data.products?.variety || "N/A";
  const caliber = specs.caliber || specs.size || "N/A";
  const color = specs.color || specs.fruit_color || "N/A";
  const brix = specs.brix || specs.sugar_content || "N/A";

  const productLabel = variety !== "N/A" ? `${productName} - Variedad: ${variety}` : productName;
  const incoterm = data.totals?.meta?.incoterm || master.default_incoterm || "FOB";

  const formatDate = (dateStr: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Document title={`Cotizacion_${data.quote_number}`}>
      <Page size="LETTER" style={styles.page}>
        
        {/* HEADER DINÁMICO */}
        <View style={styles.header}>
          <View>
            <Image src={path.join(brandDir, 'freshfood_logo.png')} style={styles.logo} />
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{company.legal_name || company.trade_name}</Text>
              <Text>RUC / TAX ID: {company.tax_id}</Text>
              <Text>Dirección: {company.address}</Text>
              <Text style={{ color: COLORS.PRIMARY, fontWeight: 'bold', marginTop: 2 }}>email: {company.contact_email}</Text>
              {company.website ? <Text>Web: {company.website}</Text> : null}
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerTitle}>Factura Proforma / Cotización</Text>
            <Text style={styles.quoteCode}>#{data.quote_number || 'BORRADOR'}</Text>
            <View style={styles.dates}>
              <Text>Emisión: {formatDate(data.created_at)}</Text>
              <Text style={{ color: COLORS.ACCENT, fontWeight: 'bold' }}>Vence: {formatDate(data.updated_at)}</Text>
            </View>
          </View>
        </View>

        {/* DATOS DEL CLIENTE Y LOGÍSTICA */}
        <View style={styles.gridContainer}>
          <View style={styles.gridCol}>
            <Text style={styles.sectionLabel}>Consignatario / Importador</Text>
            <Text style={styles.clientName}>{master.name || snapshot.name || "CLIENTE N/A"}</Text>
            <View style={styles.gridText}>
              <Text style={{ fontWeight: 'bold' }}>{master.legal_name || snapshot.legal_name || "Razón Social no definida"}</Text>
              <Text>ID Fiscal: {master.tax_id || snapshot.tax_id || "SIN TAX ID"}</Text>
              <Text>Dirección: {master.address || snapshot.address || "Dirección no definida"}</Text>
            </View>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.sectionLabel}>Logística y Entrega</Text>
            <View style={styles.gridText}>
              <Text>Incoterm: {incoterm}</Text>
              <Text>Modo: {data.mode === 'AIR' ? 'Carga Aérea' : 'Carga Marítima'}</Text>
              <Text>Destino: {data.destination}</Text>
              {specs.requested_shipment_date ? <Text>ETD Estimado: {formatDate(specs.requested_shipment_date)}</Text> : null}
            </View>
          </View>
        </View>

        {/* ESPECIFICACIONES TÉCNICAS */}
        <Text style={styles.sectionLabel}>Especificaciones de Calidad y Carga</Text>
        <View style={styles.techGrid}>
          <View style={styles.techItem}><Text style={styles.techLabel}>Variedad</Text><Text style={styles.techValue}>{variety}</Text></View>
          <View style={styles.techItem}><Text style={styles.techLabel}>Calibre / Color</Text><Text style={styles.techValue}>{caliber} / {color}</Text></View>
          <View style={styles.techItem}><Text style={styles.techLabel}>Grados Brix</Text><Text style={styles.techValue}>{brix}</Text></View>
          <View style={styles.techItemLast}><Text style={styles.techLabel}>Peso Est. (KG)</Text><Text style={styles.techValue}>{totalWeight.toLocaleString()} kg</Text></View>
        </View>

        {/* TABLA DE PRODUCTOS */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2.5 }]}>Descripción del Producto</Text>
          <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>Cajas</Text>
          <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Precio Unit. ({incoterm})</Text>
          <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Subtotal (USD)</Text>
        </View>
        <View style={styles.tableRow}>
          <View style={{ flex: 2.5 }}><Text style={styles.prodName}>{productLabel}</Text></View>
          <Text style={{ flex: 0.8, textAlign: 'center' }}>{totalBoxes}</Text>
          <Text style={{ flex: 1.2, textAlign: 'right' }}>$ {unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          <Text style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', color: COLORS.PRIMARY }}>$ {Number(finalTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>

        {/* FOOTER: BANCOS, TÉRMINOS Y TOTALES */}
        <View style={styles.footerSection}>
          <View style={styles.footerTop}>
            
            {/* Contenedor Izquierdo: Bancos + Términos */}
            <View style={styles.infoBlocksContainer}>
              
              {/* BLOQUE BANCARIO COMPLETO (ESPAÑOL) */}
              <View style={styles.bankBox}>
                <Text style={styles.bankTitle}>Instrucciones de Pago (Transferencia Bancaria)</Text>
                
                {/* Banco Principal */}
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

                {/* Banco Intermediario (Condicional) */}
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

              {/* TÉRMINOS Y CONDICIONES SEPARADOS */}
              <View style={styles.termsBox}>
                <Text style={styles.termsTitle}>Términos y Condiciones</Text>
                <Text style={styles.termsText}>
                  {data.terms || company.terms_and_conditions || "Sujeto a disponibilidad de espacio y confirmación de reserva. Los precios y fletes están sujetos a cambios por fluctuaciones del mercado. Pago requerido previo al embarque según los términos acordados."}
                </Text>
              </View>

            </View>

            {/* Contenedor Derecho: Gran Total */}
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

    // CARGAMOS AMBOS: Cotización (con cliente y producto) y Perfil de Empresa
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

    return {
      statusCode: 200,
      headers: { ...commonHeaders, "Content-Type": "application/pdf" },
      body: Buffer.concat(chunks).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err: any) {
    return text(500, `Error: ${err.message}`);
  }
};