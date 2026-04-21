// @ts-nocheck
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { renderToBuffer, Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SIG_URLS = {
  legal: "https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/firma%20david%20transparente.png",
  inspector: "https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/ronald%20chanis%20firma.png"
};

// ⚠️ Usamos el PNG público de tu logo, ya que el PDF no lee SVGs locales
const LOGO_URL = "https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/freshfood_logo.png";

// --- ESTILOS (Compactados para que todo quepa en 1 página) ---
const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b', lineHeight: 1.3 },
  headerImage: { width: 130, height: 'auto', marginBottom: 10 },
  headerFlex: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 2, borderColor: '#0f172a', paddingBottom: 8 },
  docTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' },
  docSub: { fontSize: 9, color: '#64748b', textAlign: 'right', marginTop: 2 },
  
  sectionTitle: { fontSize: 10, fontWeight: 'bold', backgroundColor: '#e2e8f0', padding: 4, marginTop: 10, marginBottom: 6, textTransform: 'uppercase' },
  
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 5 },
  gridItem: { width: '50%', marginBottom: 6, flexDirection: 'row' },
  gridLabel: { fontWeight: 'bold', width: '45%', fontSize: 9 },
  gridValue: { width: '55%', fontSize: 9, color: '#334155' },

  table: { display: "table", width: "100%", borderStyle: "solid", borderWidth: 1, borderColor: '#cbd5e1', marginTop: 5 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: '#cbd5e1' },
  th: { padding: 4, backgroundColor: '#f8fafc', fontSize: 8, fontWeight: 'bold', borderRightWidth: 1, borderColor: '#cbd5e1', width: '50%' },
  td: { padding: 4, fontSize: 8, borderRightWidth: 1, borderColor: '#cbd5e1', width: '50%' },
  
  statusOk: { color: '#166534', fontWeight: 'bold' },
  statusWarn: { color: '#b91c1c', fontWeight: 'bold' },

  verdictBox: { marginTop: 10, padding: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#94a3b8', backgroundColor: '#f8fafc' },
  
  sigBox: { marginTop: 20, width: 200 },
  sigImg: { width: 110, height: 55, objectFit: 'contain', marginLeft: -10 },
  sigLine: { borderTopWidth: 1, borderColor: '#000', paddingTop: 4, marginTop: 4 },
  sigName: { fontWeight: 'bold', fontSize: 10 },
  sigRole: { fontSize: 8, color: '#64748b' }
});

const formatCheckName = (key: string) => {
  const names: Record<string, string> = {
    external_color: "Color Externo", brix_level: "Nivel de Grados Brix", size: "Tamaño / Calibre", 
    translucency: "Traslucidez (Madurez Interna)", peduncular_mold: "Ausencia de Moho Peduncular", 
    internal_health: "Salud Interna (Sin pudrición)", aroma: "Aroma Característico", 
    insects: "Ausencia de Plagas / Insectos", packaging: "Integridad del Empaque", paletization: "Paletización y Flejado"
  };
  return names[key] || key.replace('_', ' ').toUpperCase();
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const { shipmentId, docType, payload } = JSON.parse(event.body || '{}');

  try {
    const { data: shipment, error: sErr } = await supabase.from('shipments').select('*, clients(*)').eq('id', shipmentId).single();
    if (sErr || !shipment) throw new Error("Shipment no encontrado");

    let MyTemplate;
    const dateObj = payload.date ? new Date(payload.date) : new Date();
    const formattedDate = dateObj.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });

    switch (docType) {
      
      // =========================================================
      // CERTIFICADO DE CALIDAD (Firma: Ronald Chanis)
      // =========================================================
      case 'quality_report':
        const checks = payload.checks || {};
        const checkKeys = Object.keys(checks);
        const half = Math.ceil(checkKeys.length / 2);
        const col1 = checkKeys.slice(0, half);
        const col2 = checkKeys.slice(half);

        MyTemplate = (
          <Document>
            <Page size="A4" style={styles.page}>
              
              <View style={styles.headerFlex}>
                {/* Ojo: El logo debe ser un PNG accesible públicamente */}
                <Image src={LOGO_URL} style={styles.headerImage} />
                <View>
                  <Text style={styles.docTitle}>CERTIFICADO DE CONTROL DE CALIDAD</Text>
                  <Text style={styles.docSub}>EXPEDIENTE / LOTE: {shipment.code}</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>1. INFORMACIÓN GENERAL DEL EMBARQUE</Text>
              <View style={styles.gridContainer}>
                <View style={styles.gridItem}><Text style={styles.gridLabel}>Fecha de Emisión:</Text><Text style={styles.gridValue}>{formattedDate}</Text></View>
                <View style={styles.gridItem}><Text style={styles.gridLabel}>Guía Aérea (AWB):</Text><Text style={styles.gridValue}>{shipment.awb || 'S/N'}</Text></View>
                <View style={styles.gridItem}><Text style={styles.gridLabel}>Exportador:</Text><Text style={styles.gridValue}>FRESH FOOD PANAMA, C.A.</Text></View>
                <View style={styles.gridItem}><Text style={styles.gridLabel}>Consignatario:</Text><Text style={styles.gridValue}>{shipment.clients?.legal_name || shipment.clients?.name}</Text></View>
                <View style={styles.gridItem}><Text style={styles.gridLabel}>Producto:</Text><Text style={styles.gridValue}>{shipment.product_name}</Text></View>
                <View style={styles.gridItem}><Text style={styles.gridLabel}>Variedad:</Text><Text style={styles.gridValue}>{shipment.product_variety || 'Extra Premium'}</Text></View>
                <View style={styles.gridItem}><Text style={styles.gridLabel}>Volumen de Carga:</Text><Text style={styles.gridValue}>{shipment.pallets || 0} Pallets / {shipment.boxes || 0} Cajas</Text></View>
                <View style={styles.gridItem}><Text style={styles.gridLabel}>Destino Final:</Text><Text style={styles.gridValue}>{shipment.destination}</Text></View>
              </View>

              <Text style={styles.sectionTitle}>2. PARÁMETROS FÍSICO-QUÍMICOS EVALUADOS</Text>
              <View style={styles.gridContainer}>
                <View style={styles.gridItem}><Text style={styles.gridLabel}>Calibre Predominante:</Text><Text style={styles.gridValue}>{payload.caliber || shipment.caliber || 'No especificado'}</Text></View>
                <View style={styles.gridItem}><Text style={styles.gridLabel}>Color Predominante:</Text><Text style={styles.gridValue}>{payload.color || shipment.color || 'No especificado'}</Text></View>
                <View style={styles.gridItem}><Text style={styles.gridLabel}>Grados Brix (Mín 13):</Text><Text style={styles.gridValue}>{payload.brix || shipment.brix_grade || 'No especificado'}</Text></View>
              </View>

              <Text style={styles.sectionTitle}>3. LISTA DE VERIFICACIÓN DE CALIDAD</Text>
              <View style={styles.table}>
                <View style={styles.tr}>
                  <View style={styles.th}><Text>Parámetro Evaluado</Text></View>
                  <View style={[styles.th, { width: '25%' }]}><Text>Resultado</Text></View>
                  <View style={styles.th}><Text>Parámetro Evaluado</Text></View>
                  <View style={[styles.th, { width: '25%', borderRightWidth: 0 }]}><Text>Resultado</Text></View>
                </View>
                
                {col1.map((key, index) => {
                  const key2 = col2[index];
                  return (
                    <View style={[styles.tr, index === col1.length - 1 ? { borderBottomWidth: 0 } : {}]} key={key}>
                      <View style={styles.td}><Text>{formatCheckName(key)}</Text></View>
                      <View style={[styles.td, { width: '25%' }]}>
                        <Text style={checks[key] ? styles.statusOk : styles.statusWarn}>{checks[key] ? 'CONFORME' : 'NO CONFORME'}</Text>
                      </View>
                      
                      {key2 ? (
                        <>
                          <View style={styles.td}><Text>{formatCheckName(key2)}</Text></View>
                          <View style={[styles.td, { width: '25%', borderRightWidth: 0 }]}>
                            <Text style={checks[key2] ? styles.statusOk : styles.statusWarn}>{checks[key2] ? 'CONFORME' : 'NO CONFORME'}</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={styles.td}><Text></Text></View>
                          <View style={[styles.td, { width: '25%', borderRightWidth: 0 }]}><Text></Text></View>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>

              <View style={styles.verdictBox}>
                <Text style={{ fontWeight: 'bold', fontSize: 10, marginBottom: 4 }}>DICTAMEN FINAL: {payload.verdict?.toUpperCase() || 'APROBADO'}</Text>
                <Text style={{ fontSize: 9, color: '#475569', textAlign: 'justify' }}>{payload.observations || 'La fruta se encuentra en óptimas condiciones fitosanitarias y de calidad, cumpliendo con los estándares exigidos para exportación.'}</Text>
              </View>

              {/* Firma asignada a Ronald Chanis */}
              <View style={styles.sigBox}>
                <Image src={SIG_URLS.inspector} style={styles.sigImg} />
                <View style={styles.sigLine}>
                  <Text style={styles.sigName}>Ronald Chanis</Text>
                  <Text style={styles.sigRole}>Inspector de Calidad</Text>
                  <Text style={styles.sigRole}>Fresh Food Panama, C.A.</Text>
                </View>
              </View>

            </Page>
          </Document>
        );
        break;

      // =========================================================
      // LOS DEMÁS DOCUMENTOS QUEDAN PENDIENTES O EN CONSTRUCCIÓN
      // =========================================================
      case 'non_recyclable_plastics':
        // (Aquí iría la declaración de plásticos que te pasé en el bloque anterior)
        MyTemplate = <Document><Page size="A4" style={{ padding: 40 }}><Text>Declaración de Plásticos activa.</Text></Page></Document>;
        break;
      
      case 'packing_list':
      case 'additives_declaration':
        MyTemplate = <Document><Page size="A4" style={{ padding: 40 }}><Text>Plantilla en construcción...</Text></Page></Document>;
        break;

      default:
        throw new Error("DocType no soportado");
    }

    const pdfBuffer = await renderToBuffer(MyTemplate);
    const fileName = `${docType}_${shipment.code}.pdf`;
    const storagePath = `${shipment.code}/${fileName}`;
    
    await supabase.storage.from('shipment-docs').upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    await supabase.from('shipment_files').insert({ shipment_id: shipmentId, kind: 'doc', doc_type: docType, filename: fileName, storage_path: storagePath, bucket: 'shipment-docs' });

    return { statusCode: 200, body: JSON.stringify({ message: "Éxito", fileName }) };
  } catch (error: any) {
    console.error("Error:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};