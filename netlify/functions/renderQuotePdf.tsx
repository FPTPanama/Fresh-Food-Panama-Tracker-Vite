import type { Handler } from "@netlify/functions";
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToStream, Image } from '@react-pdf/renderer';
import path from 'path';
import { 
  sbAdmin, 
  optionsResponse, 
  text,
  commonHeaders 
} from "./_util";

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
  prodName: { fontSize: 10, fontWeight: 'bold', color: COLORS.TEXT_MAIN, textTransform: 'uppercase' },
  footerSection: { position: 'absolute', bottom: '15mm', left: '15mm', right: '15mm' },
  footerTop: { flexDirection: 'row', justifyContent: 'space-between', borderTop: `1 solid ${COLORS.BORDER}`, paddingTop: 15 },
  termsBox: { maxWidth: '60%' },
  termsTitle: { fontSize: 7, fontWeight: 'bold', color: COLORS.PRIMARY, textTransform: 'uppercase', marginBottom: 4 },
  termsText: { fontSize: 7, color: COLORS.TEXT_LIGHT, lineHeight: 1.4 },
  totalContainer: { textAlign: 'right', backgroundColor: COLORS.PRIMARY, padding: 12, borderRadius: 8, minWidth: 150 },
  totalLabel: { fontSize: 7, fontWeight: 'bold', color: COLORS.PRIMARY_LIGHT, textTransform: 'uppercase', marginBottom: 2 },
  totalAmount: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  signatureRow: { marginTop: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  signatureLine: { width: 140, borderTop: `1 solid ${COLORS.TEXT_LIGHT}`, paddingTop: 5, textAlign: 'center', fontSize: 7, color: COLORS.TEXT_LIGHT, textTransform: 'uppercase' }
});

const PdfTemplate = ({ data, brandDir }: { data: any, brandDir: string }) => {
  // --- EXTRACCIÓN MAESTRA (NORMALIZACIÓN DE JOIN) ---
  const masterRaw = data.clients;
  const master = Array.isArray(masterRaw) ? masterRaw[0] : (masterRaw || {});
  const snapshot = data.client_snapshot || {};

  // Ubicación del cliente (Ciudad y País)
  const city = master.city || snapshot.city || "";
  const country = master.country || snapshot.country || "";
  const locationLine = `${city}${city && country ? ", " : ""}${country}`.trim();

  // --- DATOS DE PRODUCTO Y FICHA TÉCNICA (PROTECCIÓN DE DATOS) ---
  // Buscamos en 'items_snapshot' o en el objeto raíz de la quote
  const item = (data.items_snapshot && data.items_snapshot[0]) || {};
  const specs = data.product_details || {};
  
  const productName = specs.product_name || item.product_name || data.product_name || "PRODUCTO";
  const variety = specs.variety || item.variety || data.variety || "N/A";
  const caliber = specs.caliber || item.caliber || data.caliber || "N/A";
  const color = specs.color || item.color || data.color || "N/A";
  const brix = specs.brix || item.brix || data.brix || "N/A";

  const productLabel = `${productName} ${variety !== "N/A" ? variety : ""} - CALIDAD DE EXPORTACIÓN`.trim();

  const formatDate = (dateStr: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Document title={`Cotizacion_${data.quote_number}`}>
      <Page size="LETTER" style={styles.page}>
        
        {/* HEADER CORPORATIVO */}
        <View style={styles.header}>
          <View>
            <Image src={path.join(brandDir, 'freshfood_logo.png')} style={styles.logo} />
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>FRESH FOOD PANAMÁ, C.A.</Text>
              <Text>RUC: 155716550-2-2022-DV 25</Text>
              <Text>Panamá, República de Panamá</Text>
              <Text style={{ color: COLORS.PRIMARY_LIGHT, fontWeight: 'bold' }}>exports@freshfoodpanama.com</Text>
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

        {/* INFO CLIENTE CON CIUDAD Y PAÍS */}
        <View style={styles.gridContainer}>
          <View style={styles.gridCol}>
            <Text style={styles.sectionLabel}>Consignatario / Importador</Text>
            <Text style={styles.clientName}>{master.name || snapshot.name || "CLIENTE N/A"}</Text>
            <View style={styles.gridText}>
              <Text style={{ fontWeight: 'bold' }}>{master.legal_name || "Razón Social no definida"}</Text>
              <Text>ID Fiscal: {master.tax_id || "SIN TAX ID"}</Text>
              {locationLine && <Text>Ubicación: {locationLine}</Text>}
              <Text>Dirección: {master.address || "Dirección no definida"}</Text>
            </View>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.sectionLabel}>Logística y Entrega</Text>
            <View style={styles.gridText}>
              <Text>Incoterm: {data.totals?.meta?.incoterm || master.default_incoterm || "CIP"} 2020</Text>
              <Text>Modo: {data.mode === 'AIR' ? 'Carga Aérea' : 'Carga Marítima'}</Text>
              <Text>Destino: {data.destination}</Text>
            </View>
          </View>
        </View>

        {/* FICHA TÉCNICA (SINCRONIZADA) */}
        <Text style={styles.sectionLabel}>Especificaciones de Calidad</Text>
        <View style={styles.techGrid}>
          <View style={styles.techItem}><Text style={styles.techLabel}>Variedad</Text><Text style={styles.techValue}>{variety}</Text></View>
          <View style={styles.techItem}><Text style={styles.techLabel}>Calibre</Text><Text style={styles.techValue}>{caliber}</Text></View>
          <View style={styles.techItem}><Text style={styles.techLabel}>Color</Text><Text style={styles.techValue}>{color}</Text></View>
          <View style={styles.techItemLast}><Text style={styles.techLabel}>Grados Brix</Text><Text style={styles.techValue}>{brix}</Text></View>
        </View>

        {/* TABLA COMERCIAL */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 3 }]}>Descripción del Producto</Text>
          <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Cajas</Text>
          <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Subtotal (USD)</Text>
        </View>
        <View style={styles.tableRow}>
          <View style={{ flex: 3 }}>
            <Text style={styles.prodName}>{productLabel}</Text>
          </View>
          <Text style={{ flex: 1, textAlign: 'center' }}>{data.boxes || 0}</Text>
          <Text style={{ flex: 1.2, textAlign: 'right', fontWeight: 'bold', color: COLORS.PRIMARY }}>
            $ {Number(data.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>

        {/* PIE DE PÁGINA */}
        <View style={styles.footerSection}>
          <View style={styles.footerTop}>
            <View style={styles.termsBox}>
              <Text style={styles.termsTitle}>Términos y Condiciones</Text>
              <Text style={styles.termsText}>{data.terms || "Sujeto a disponibilidad de espacio."}</Text>
            </View>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Monto Total a Pagar</Text>
              <Text style={styles.totalAmount}>$ {Number(data.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
          <View style={styles.signatureRow}>
            <Text style={{ fontSize: 7, color: COLORS.TEXT_LIGHT }}>Fresh Food Panamá - Exportación Premium</Text>
            <Text style={styles.signatureLine}>Firma Autorizada</Text>
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

    const { data, error } = await sbAdmin
      .from("quotes")
      .select("*, clients(*)")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return text(404, "Cotización no encontrada");

    const brandDir = path.join(process.cwd(), "public", "brand");
    const stream = await renderToStream(<PdfTemplate data={data} brandDir={brandDir} />);
    const chunks: any[] = [];
    for await (const chunk of stream) { chunks.push(chunk); }

    return {
      statusCode: 200,
      headers: { ...commonHeaders, "Content-Type": "application/pdf" },
      body: Buffer.concat(chunks).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err: any) {
    return text(500, `Error Servidor: ${err.message}`);
  }
};