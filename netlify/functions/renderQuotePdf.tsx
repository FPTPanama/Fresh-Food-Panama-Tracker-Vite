import type { Handler } from "@netlify/functions";
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToStream, Image } from '@react-pdf/renderer';
import path from 'path';
import { 
  sbAdmin, 
  getUserAndProfile, 
  isPrivilegedRole, 
  optionsResponse, 
  text,
  commonHeaders 
} from "./_util";

// 1. ESTILOS - MANTENIDOS SEGÚN TU DISEÑO
const styles = StyleSheet.create({
  page: { padding: '18mm', fontFamily: 'Helvetica', fontSize: 10, color: '#334155', backgroundColor: '#FFFFFF', position: 'relative' },
  watermarkContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: -1 },
  watermarkImage: { width: 480, opacity: 0.03 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1 solid #f1f5f9', paddingBottom: 15, marginBottom: 25 },
  logo: { width: 185, marginTop: -8 },
  companySub: { fontSize: 8, color: '#64748b', lineHeight: 1.2, marginTop: 4 },
  headerRight: { textAlign: 'right' },
  headerLabel: { fontSize: 8, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
  quoteNumber: { fontSize: 14, fontWeight: 'bold', color: '#234d23' },
  gridContainer: { flexDirection: 'row', border: '1 solid #f1f5f9', borderRadius: 6, overflow: 'hidden', marginBottom: 25 },
  gridColLeft: { flex: 1.2, padding: 15, borderRight: '1 solid #f1f5f9' },
  gridColRight: { flex: 1, padding: 15, backgroundColor: '#f8fafc' },
  sectionTitle: { fontSize: 8, fontWeight: 'bold', color: '#d17711', textTransform: 'uppercase', marginBottom: 8 },
  clientName: { fontSize: 10, fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', marginBottom: 6 },
  clientRow: { flexDirection: 'row', fontSize: 8, marginBottom: 2 },
  labelGris: { color: '#94a3b8', marginRight: 4 }, 
  valueNegro: { color: '#334155' },
  tableHeader: { flexDirection: 'row', borderBottom: '2 solid #f1f5f9', paddingBottom: 8, marginBottom: 10 },
  th: { fontSize: 8, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', borderBottom: '1 solid #f8fafc', paddingVertical: 12, alignItems: 'center' },
  tdMain: { fontSize: 9, fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase' },
  tdSpecs: { fontSize: 8, color: '#94a3b8', marginTop: 2 }, 
  bottomContainer: { position: 'absolute', bottom: '18mm', left: '18mm', right: '18mm', borderTop: '1 solid #f1f5f9', paddingTop: 20 },
  termsTitle: { fontSize: 8, fontWeight: 'bold', color: '#d17711', textTransform: 'uppercase', borderBottom: '1 solid #ffe4cc', alignSelf: 'flex-start', marginBottom: 8 },
  totalBox: { textAlign: 'right' },
  totalLabel: { fontSize: 8, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
  totalAmount: { fontSize: 22, fontWeight: 'bold', color: '#234d23' },
  footerText: { fontSize: 7, color: '#cbd5e1', textTransform: 'uppercase', marginTop: 15 }
});

// 2. COMPONENTE DEL PDF
const PdfTemplate = ({ data, brandDir }: { data: any, brandDir: string }) => {
  const isEn = data.lang === 'en';
  const emission = data.created_at ? new Date(data.created_at) : new Date();
  const expiry = new Date(emission);
  expiry.setDate(expiry.getDate() + 5);

  const formatDate = (date: Date) => date.toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
  
  // FIX CERTERO: Asegurar que los campos JSONB no rompan el renderizado
  const cleanStr = (val: any) => {
    if (typeof val === 'string') return val.replace(/[{}"]/g, '');
    return '—';
  };

  // Extraer con seguridad de columnas JSONB
  const details = data.product_details || {};
  const totalsMetadata = data.totals?.meta || {};
  
  const finalTotal = Number(data.total) || 0; 
  const quantity = Number(data.boxes) || 0; 
  const unitPrice = quantity > 0 ? finalTotal / quantity : 0; 
  const displayIncoterm = totalsMetadata.incoterm || "N/A";

  return (
    <Document title={`Cotización ${data.quote_number || 'S-N'}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.watermarkContainer}>
          <Image src={path.join(brandDir, 'FFPWM.png')} style={styles.watermarkImage} />
        </View>

        <View style={styles.header}>
          <View>
            <Image src={path.join(brandDir, 'freshfood_logo.png')} style={styles.logo} />
            <View style={styles.companySub}>
              <Text style={{ fontWeight: 'bold', color: '#234d23', fontSize: 9 }}>Fresh Food Panamá, C.A.</Text>
              <Text>RUC: 2684372-1-845616 DV 30</Text>
              <Text>administracion@freshfoodpanama.com</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerLabel}>{isEn ? 'Export Quotation' : 'Cotización de Exportación'}</Text>
            <Text style={styles.quoteNumber}>#{data.quote_number || 'FFP'}</Text>
            <View style={{ marginTop: 8, fontSize: 8 }}>
              <Text><Text style={{ color: '#94a3b8' }}>Emisión: </Text>{formatDate(emission)}</Text>
              <Text><Text style={{ color: '#94a3b8' }}>Vence: </Text><Text style={{ color: '#d17711', fontWeight: 'bold' }}>{formatDate(expiry)}</Text></Text>
            </View>
          </View>
        </View>

        <View style={styles.gridContainer}>
          <View style={styles.gridColLeft}>
            <Text style={styles.sectionTitle}>Consignatario</Text>
            <Text style={styles.clientName}>{data.clients?.legal_name || data.clients?.name || 'N/A'}</Text>
            <View style={styles.clientRow}><Text style={styles.labelGris}>TaxID:</Text><Text style={styles.valueNegro}>{data.clients?.tax_id || '—'}</Text></View>
            <View style={styles.clientRow}><Text style={styles.labelGris}>Dir:</Text><Text style={styles.valueNegro}>{data.clients?.address || '—'}</Text></View>
          </View>

          <View style={styles.gridColRight}>
            <Text style={styles.sectionTitle}>Logística de Entrega</Text>
            <View style={{ gap: 4, fontSize: 9 }}>
              <Text><Text style={{ color: '#94a3b8' }}>Cajas:</Text> {quantity}</Text>
              <Text><Text style={{ color: '#94a3b8' }}>Peso:</Text> {data.weight_kg || 0} Kg</Text>
              <Text><Text style={{ color: '#94a3b8' }}>Incoterm:</Text> <Text style={{ color: '#234d23', fontWeight: 'bold' }}>{displayIncoterm} - {data.destination || '—'}</Text></Text>
              <Text><Text style={{ color: '#94a3b8' }}>Modo:</Text> {data.mode === 'AIR' ? 'Aéreo' : 'Marítimo'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 3.5 }]}>Producto</Text>
          <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Cant.</Text>
          <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Precio Unit.</Text>
          <Text style={[styles.th, { flex: 1.5, textAlign: 'right', color: '#234d23' }]}>TOTAL</Text>
        </View>

        <View style={styles.tableRow}>
          <View style={{ flex: 3.5 }}>
            <Text style={styles.tdMain}>{data.products?.name || 'Producto'} {cleanStr(details.variety)}</Text>
            <Text style={styles.tdSpecs}>Cal: {details.caliber || 'N/A'} • Color: {details.color || 'N/A'}</Text>
          </View>
          <Text style={{ flex: 1, textAlign: 'center' }}>{quantity}</Text>
          <Text style={{ flex: 1.2, textAlign: 'right' }}>$ {unitPrice.toFixed(2)}</Text>
          <Text style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', color: '#234d23' }}>$ {finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>

        <View style={styles.bottomContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ maxWidth: '60%' }}>
              <Text style={styles.termsTitle}>Términos y Condiciones</Text>
              <Text style={{ fontSize: 8, color: '#64748b', lineHeight: 1.4 }}>
                {typeof data.terms === 'string' ? data.terms : "• Validez: 5 días hábiles.\n• Logística: Incluye trámites fitosanitarios."}
              </Text>
            </View>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Monto Total a Pagar</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end' }}>
                <Text style={{ fontSize: 10, color: '#94a3b8', marginRight: 4 }}>USD</Text>
                <Text style={styles.totalAmount}>$ {finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.footerText}>Fresh Food Panamá, C.A. • Calidad de Exportación Premium</Text>
        </View>
      </Page>
    </Document>
  );
};

// 3. HANDLER PRINCIPAL
export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();

  try {
    const { user, profile } = await getUserAndProfile(event);
    
    if (!user || !profile) return text(401, "No autorizado");
    if (!isPrivilegedRole(profile.role)) return text(403, "Acceso denegado");

    const id = event.queryStringParameters?.id;
    if (!id) return text(400, "ID de cotización requerido");

    const { data, error } = await sbAdmin
      .from("quotes")
      .select("*, clients(*), products(*)")
      .eq("id", id)
      .maybeSingle(); 

    if (error || !data) return text(404, "Cotización no encontrada");

    const brandDir = path.join(process.cwd(), "public", "brand");

    const stream = await renderToStream(<PdfTemplate data={data} brandDir={brandDir} />);
    
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    return {
      statusCode: 200,
      headers: {
        ...commonHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Cotizacion_${data.quote_number || id}.pdf"`,
      },
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err: any) {
    console.error("Error crítico:", err);
    return text(500, `Error interno: ${err.message}`);
  }
};