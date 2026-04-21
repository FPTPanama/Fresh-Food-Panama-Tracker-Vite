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
  PRIMARY: '#0f172a',      
  PRIMARY_LIGHT: '#64748b', 
  ACCENT: '#f59e0b',       
  SUCCESS: '#10b981',      
  TEXT_MAIN: '#1e293b',     
  TEXT_LIGHT: '#64748b',    
  BG_SOFT: '#f8fafc',       
  BORDER: '#e2e8f0'         
};

const styles = StyleSheet.create({
  page: { padding: '15mm', fontFamily: 'Helvetica', fontSize: 9, color: COLORS.TEXT_MAIN, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2 solid ${COLORS.ACCENT}`, paddingBottom: 15, marginBottom: 20 },
  logo: { width: 120, marginBottom: 5 },
  headerRight: { textAlign: 'right' },
  headerTitle: { fontSize: 10, fontWeight: 'bold', color: COLORS.PRIMARY, textTransform: 'uppercase', letterSpacing: 1 },
  poCode: { fontSize: 18, fontWeight: 'bold', color: COLORS.ACCENT, marginTop: 5 },
  refQuote: { fontSize: 8, color: COLORS.TEXT_LIGHT, marginTop: 2 },
  gridContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  gridCol: { flex: 1, padding: 12, border: `1 solid ${COLORS.BORDER}`, borderRadius: 6 },
  sectionLabel: { fontSize: 7, fontWeight: 'bold', color: COLORS.PRIMARY_LIGHT, textTransform: 'uppercase', marginBottom: 5, borderBottom: `1 solid ${COLORS.BG_SOFT}`, paddingBottom: 2 },
  buyerName: { fontSize: 10, fontWeight: 'bold', color: COLORS.PRIMARY, textTransform: 'uppercase' },
  
  // --- ESTILOS DE TABLA ACTUALIZADOS ---
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.PRIMARY, padding: 8, borderRadius: 4, marginBottom: 5 },
  th: { fontSize: 7, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: 8, borderBottom: `1 solid ${COLORS.BG_SOFT}`, alignItems: 'center' },
  prodName: { fontSize: 9, fontWeight: 'bold', color: COLORS.TEXT_MAIN, textTransform: 'uppercase' },
  
  techGrid: { flexDirection: 'row', border: `1 solid ${COLORS.BORDER}`, borderRadius: 6, marginBottom: 20, padding: 8, backgroundColor: COLORS.BG_SOFT },
  techItem: { flex: 1, borderRight: `1 solid ${COLORS.BORDER}`, paddingHorizontal: 5 },
  techItemLast: { flex: 1, paddingHorizontal: 5 },
  techLabel: { fontSize: 6, color: COLORS.TEXT_LIGHT, textTransform: 'uppercase', marginBottom: 2 },
  techValue: { fontSize: 8, fontWeight: 'bold' },
  footerSection: { position: 'absolute', bottom: '15mm', left: '15mm', right: '15mm' },
  totalContainer: { textAlign: 'right', backgroundColor: COLORS.PRIMARY, padding: 12, borderRadius: 8, minWidth: 160 },
  totalLabel: { fontSize: 7, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
  totalAmount: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  signatureArea: { marginTop: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  signatureLine: { width: 180, borderTop: `1 solid ${COLORS.BORDER}`, paddingTop: 8, textAlign: 'center' },
  approvalStamp: { border: `2 solid ${COLORS.SUCCESS}`, padding: 6, borderRadius: 4, width: 160, textAlign: 'center' },
  stampText: { color: COLORS.SUCCESS, fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' },
  stampDate: { color: COLORS.SUCCESS, fontSize: 6, marginTop: 2 }
});

const PdfTemplate = ({ data, brandDir }: { data: any, brandDir: string }) => {
  const masterRaw = data.clients || {};
  const master = Array.isArray(masterRaw) ? masterRaw[0] : (masterRaw || {});
  const snapshot = data.client_snapshot || {};
  
  const finalTotal = data.totals?.grand_total || data.totals?.total || data.total_amount || data.total || 0;
  
  const specs = data.product_details || {};
  const item = (data.items_snapshot && data.items_snapshot[0]) || {};

  // CORRECCIÓN DINÁMICA: Extraemos el producto real de la BD
  const prodRel = Array.isArray(data.products) ? data.products[0] : (data.products || {});
  const productName = prodRel.name || specs.product_name || specs.name || "Producto Fresco";
  const variety = specs.variety || prodRel.variety || "N/A";
  
  const caliber = specs.caliber || specs.size || item.caliber || "N/A";
  const color = specs.color || specs.fruit_color || item.color || "N/A";
  const brix = specs.brix || specs.sugar_content || item.brix || "N/A";

  const productLabel = variety !== "N/A" ? `${productName} - Variedad: ${variety}` : productName;

  const year = new Date(data.created_at).getFullYear();
  const rawNum = data.quote_number?.split('/').pop() || data.id.slice(0,4).toUpperCase();
  const poNumber = data.po_number || `PO/${year}/${rawNum}`;

  // Extraer las líneas de cotización dinámicas
  const quoteItems = data.totals?.items || [];

  const formatDateWithTime = (dateStr: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleDateString('es-PA', { 
      day: '2-digit', month: 'short', year: 'numeric' 
    }) + ' ' + d.toLocaleTimeString('es-PA', { 
      hour: '2-digit', minute: '2-digit', hour12: true 
    }).toUpperCase();
  };

  const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return 'POR DEFINIR';
    const cleanDate = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00Z`;
    const d = new Date(cleanDate);
    return d.toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // HOMOLOGACIÓN: Usar exactamente la misma variable de la cotización
  const etd = specs.requested_shipment_date;

  return (
    <Document title={`PO_${poNumber.replace(/\//g, '_')}`}>
      <Page size="LETTER" style={styles.page}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Image src={path.join(brandDir, 'freshfood_logo.png')} style={styles.logo} />
            <Text style={{ fontSize: 7, color: COLORS.TEXT_LIGHT }}>Fresh Food Panamá, C.A. | RUC 155716550-2-2022-DV 25</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerTitle}>Orden de Compra / Purchase Order</Text>
            <Text style={styles.poCode}>{poNumber}</Text>
            <Text style={styles.refQuote}>Ref. Cotización: {data.quote_number}</Text>
          </View>
        </View>

        {/* COMPRADOR VS VENDEDOR */}
        <View style={styles.gridContainer}>
          <View style={styles.gridCol}>
            <Text style={styles.sectionLabel}>Emitido por (Buyer):</Text>
            <Text style={styles.buyerName}>{master.name || snapshot.name || "CLIENTE"}</Text>
            <Text style={{ fontSize: 8, marginTop: 4 }}>ID Fiscal: {master.tax_id || snapshot.tax_id || "N/A"}</Text>
            <Text style={{ fontSize: 8 }}>{master.address || snapshot.address || "Dirección no definida"}</Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.sectionLabel}>Dirigido a (Seller):</Text>
            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>FRESH FOOD PANAMÁ, C.A.</Text>
            <Text style={{ fontSize: 8 }}>Vía Tocumen, Ciudad de Panamá</Text>
            <Text style={{ fontSize: 8 }}>adminsitracion@freshfoodpanama.com</Text>
          </View>
        </View>

        {/* LOGÍSTICA */}
        <View style={{ marginBottom: 20, padding: 10, backgroundColor: COLORS.BG_SOFT, borderRadius: 6, border: `1 solid ${COLORS.BORDER}` }}>
          <Text style={styles.sectionLabel}>Instrucciones de Compra y Embarque</Text>
          <View style={{ flexDirection: 'row', marginTop: 5 }}>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 6, color: COLORS.TEXT_LIGHT }}>INCOTERM</Text><Text style={{ fontSize: 8, fontWeight: 'bold' }}>{data.totals?.meta?.incoterm || "CIP"} 2020</Text></View>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 6, color: COLORS.TEXT_LIGHT }}>MODO</Text><Text style={{ fontSize: 8, fontWeight: 'bold' }}>{data.mode === 'AIR' ? 'AÉREO' : 'MARÍTIMO'}</Text></View>
            <View style={{ flex: 1.5 }}><Text style={{ fontSize: 6, color: COLORS.TEXT_LIGHT }}>DESTINO FINAL</Text><Text style={{ fontSize: 8, fontWeight: 'bold' }}>{data.destination}</Text></View>
            <View style={{ flex: 1.5 }}><Text style={{ fontSize: 6, color: COLORS.ACCENT }}>EST. DEPARTURE (ETD)</Text><Text style={{ fontSize: 8, fontWeight: 'bold', color: COLORS.ACCENT }}>{formatDateOnly(etd)}</Text></View>
          </View>
        </View>

        {/* FICHA TÉCNICA */}
        <Text style={styles.sectionLabel}>Especificaciones Técnicas del Producto</Text>
        <View style={styles.techGrid}>
          <View style={styles.techItem}><Text style={styles.techLabel}>Producto</Text><Text style={styles.techValue}>{productName}</Text></View>
          <View style={styles.techItem}><Text style={styles.techLabel}>Variedad</Text><Text style={styles.techValue}>{variety}</Text></View>
          <View style={styles.techItem}><Text style={styles.techLabel}>Calibre</Text><Text style={styles.techValue}>{caliber}</Text></View>
          <View style={styles.techItem}><Text style={styles.techLabel}>Color Fruta</Text><Text style={styles.techValue}>{color}</Text></View>
          <View style={styles.techItemLast}><Text style={styles.techLabel}>Grados Brix</Text><Text style={styles.techValue}>{brix}</Text></View>
        </View>

        {/* TABLA DE COSTOS Y RECARGOS (RENDERIZADO DINÁMICO) */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2.5 }]}>Descripción del Pedido / Servicio</Text>
          <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>Cant.</Text>
          <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>P. Unit (USD)</Text>
          <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Subtotal (USD)</Text>
        </View>

        {quoteItems.length > 0 ? (
          /* Mapeo de todas las líneas dinámicas de la cotización */
          quoteItems.map((item: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <View style={{ flex: 2.5 }}>
                <Text style={styles.prodName}>{item.name}</Text>
              </View>
              <Text style={{ flex: 0.8, textAlign: 'center', fontSize: 9 }}>
                {item.qty || 1}
              </Text>
              <Text style={{ flex: 1.2, textAlign: 'right', fontSize: 9 }}>
                $ {Number(item.unit || item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', fontSize: 9 }}>
                $ {Number(item.totalRow || item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          ))
        ) : (
          /* Fallback para cotizaciones viejas (Muestra solo 1 fila) */
          <View style={styles.tableRow}>
            <View style={{ flex: 2.5 }}>
              <Text style={styles.prodName}>{productLabel}</Text>
              <Text style={{ fontSize: 7, color: COLORS.TEXT_LIGHT, marginTop: 2 }}>Calidad Premium - Inspeccionado en Origen</Text>
            </View>
            <Text style={{ flex: 0.8, textAlign: 'center', fontSize: 9 }}>{data.boxes || 0}</Text>
            <Text style={{ flex: 1.2, textAlign: 'right', fontSize: 9 }}>
               $ {((data.boxes || 0) > 0 ? (Number(finalTotal) / (data.boxes || 1)) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', fontSize: 9 }}>
              $ {Number(finalTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        )}

        {/* FOOTER CON SELLO DIGITAL DETALLADO */}
        <View style={styles.footerSection}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ width: '55%' }}>
              <Text style={styles.sectionLabel}>Declaración de Aceptación</Text>
              <Text style={{ fontSize: 7, color: COLORS.TEXT_LIGHT, lineHeight: 1.4 }}>
                Este documento confirma la aceptación de la cotización {data.quote_number}. El comprador autoriza la facturación y el inicio del proceso logístico bajo los términos estipulados.
              </Text>
            </View>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Monto Total de la Orden</Text>
              <Text style={styles.totalAmount}>$ {Number(finalTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
          
          <View style={styles.signatureArea}>
            <View style={styles.approvalStamp}>
              <Text style={styles.stampText}>APROBADO DIGITALMENTE</Text>
              <Text style={styles.stampDate}>AUTH-ID: {data.id.slice(0,12).toUpperCase()}</Text>
              <Text style={styles.stampDate}>{formatDateWithTime(data.updated_at)}</Text>
            </View>
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
    // INYECCIÓN: Agregamos products(*) al select para recuperar el nombre dinámicamente
    const { data, error } = await sbAdmin.from("quotes").select("*, clients(*), products(*)").eq("id", id).maybeSingle();
    if (error || !data) return text(404, "No encontrado");

    const brandDir = path.join(process.cwd(), "public", "brand");
    const stream = await renderToStream(<PdfTemplate data={data} brandDir={brandDir} />);
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) { chunks.push(chunk as Uint8Array); }

    return {
      statusCode: 200,
      headers: { ...commonHeaders, "Content-Type": "application/pdf" },
      body: Buffer.concat(chunks).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err: any) {
    return text(500, err.message);
  }
};