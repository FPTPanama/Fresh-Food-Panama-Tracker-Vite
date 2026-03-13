import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToStream, Image } from '@react-pdf/renderer';
import path from 'path';

// 1. CONFIGURACIÓN SUPABASE
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// 2. ESTILOS DEFINITIVOS
const styles = StyleSheet.create({
  page: { 
    padding: '18mm', 
    fontFamily: 'Helvetica', 
    fontSize: 10, 
    color: '#334155', 
    backgroundColor: '#FFFFFF', 
    position: 'relative' 
  },
  watermarkContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  watermarkImage: {
    width: 480,
    opacity: 0.03,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    borderBottom: '1 solid #f1f5f9', 
    paddingBottom: 15, 
    marginBottom: 25 
  },
  logo: { 
    width: 185, 
    marginTop: -8 
  },
  companySub: { 
    fontSize: 8, 
    color: '#64748b', 
    lineHeight: 1.2,
    marginTop: 4
  },
  headerRight: { 
    textAlign: 'right' 
  },
  headerLabel: { 
    fontSize: 8, 
    fontWeight: 'bold', 
    color: '#94a3b8', 
    textTransform: 'uppercase', 
    marginBottom: 2 
  },
  quoteNumber: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#234d23' 
  },
  gridContainer: { 
    flexDirection: 'row', 
    border: '1 solid #f1f5f9', 
    borderRadius: 6, 
    overflow: 'hidden', 
    marginBottom: 25 
  },
  gridColLeft: { flex: 1.2, padding: 15, borderRight: '1 solid #f1f5f9' },
  gridColRight: { flex: 1, padding: 15, backgroundColor: '#f8fafc' },
  sectionTitle: { 
    fontSize: 8, 
    fontWeight: 'bold', 
    color: '#d17711', 
    textTransform: 'uppercase', 
    marginBottom: 8 
  },
  clientName: { 
    fontSize: 10, 
    fontWeight: 'bold', 
    color: '#0f172a', 
    textTransform: 'uppercase', 
    marginBottom: 6 
  },
  clientRow: { 
    flexDirection: 'row', 
    fontSize: 8, 
    marginBottom: 2 
  },
  labelGris: { 
    color: '#94a3b8', 
    marginRight: 4 
  }, 
  valueNegro: { 
    color: '#334155', 
    fontWeight: 'normal'
  },
  tableHeader: { 
    flexDirection: 'row', 
    borderBottom: '2 solid #f1f5f9', 
    paddingBottom: 8, 
    marginBottom: 10 
  },
  th: { 
    fontSize: 8, 
    fontWeight: 'bold', 
    color: '#94a3b8', 
    textTransform: 'uppercase' 
  },
  tableRow: { 
    flexDirection: 'row', 
    borderBottom: '1 solid #f8fafc', 
    paddingVertical: 12, 
    alignItems: 'center' 
  },
  tdMain: { 
    fontSize: 9, 
    fontWeight: 'bold', 
    color: '#0f172a', 
    textTransform: 'uppercase' 
  },
  tdSpecs: { 
    fontSize: 8, 
    color: '#94a3b8', 
    marginTop: 2 
  }, 
  bottomContainer: { 
    position: 'absolute', 
    bottom: '18mm', 
    left: '18mm', 
    right: '18mm', 
    borderTop: '1 solid #f1f5f9', 
    paddingTop: 20 
  },
  termsTitle: { 
    fontSize: 8, 
    fontWeight: 'bold', 
    color: '#d17711', 
    textTransform: 'uppercase', 
    borderBottom: '1 solid #ffe4cc', 
    alignSelf: 'flex-start', 
    marginBottom: 8 
  },
  totalBox: { 
    textAlign: 'right' 
  },
  totalLabel: { 
    fontSize: 8, 
    fontWeight: 'bold', 
    color: '#94a3b8', 
    textTransform: 'uppercase', 
    marginBottom: 2 
  },
  totalAmount: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#234d23' 
  },
  footerText: { 
    fontSize: 7, 
    color: '#cbd5e1', 
    textTransform: 'uppercase', 
    marginTop: 15 
  }
});

// 3. COMPONENTE TEMPLATE
const PdfTemplate = ({ data }: { data: any }) => {
  const isEn = data.lang === 'en';
  const emission = new Date(data.created_at);
  const expiry = new Date(emission);
  expiry.setDate(expiry.getDate() + 5);

  const formatDate = (date: Date) => date.toLocaleDateString('es-PA', { 
    day: '2-digit', month: 'short', year: 'numeric' 
  });
  
  const cleanStr = (str: any) => typeof str === 'string' ? str.replace(/[{}"]/g, '') : 'N/A';
  
  // --- LÓGICA CORREGIDA SEGÚN TU IMAGEN ---
  // data.total es el GRAN TOTAL de la factura ($7,480.00 en tu ejemplo)
  const finalTotal = Number(data.total) || 0; 
  const quantity = Number(data.boxes) || 1; // Evitar división por cero
  
  // El precio unitario es el total dividido entre las cajas
  const unitPrice = finalTotal / quantity; 

  const incotermDisplay = `${data.terms || 'CIP'} - ${data.destination || 'TBD'}`;

  const clientData = {
    legalName: data.clients?.legal_name || data.client_snapshot?.legal_name || data.clients?.name || 'N/A',
    taxId: data.clients?.tax_id || data.client_snapshot?.tax_id || 'N/A',
    address: data.clients?.address || data.client_snapshot?.address || 'N/A',
    phone: data.clients?.phone || 'N/A',
    website: data.clients?.website || 'N/A'
  };

  const pName = data.products?.name || 'PIÑA';
  const pVariety = cleanStr(data.product_details?.variety || data.products?.variety);
  const pCaliber = data.product_details?.caliber || 'N/A';
  const pColor = data.product_details?.color || 'N/A';
  const pBrix = data.product_details?.brix || 'N/A';

  const brandDir = path.join(process.cwd(), "public", "brand");

  return (
    <Document title={`Cotización ${data.quote_number}`}>
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
            <Text style={styles.clientName}>{clientData.legalName}</Text>
            <View style={styles.clientRow}><Text style={styles.labelGris}>TaxID:</Text><Text style={styles.valueNegro}>{clientData.taxId}</Text></View>
            <View style={styles.clientRow}><Text style={styles.labelGris}>Dir:</Text><Text style={styles.valueNegro}>{clientData.address}</Text></View>
            <View style={styles.clientRow}><Text style={styles.labelGris}>Tel:</Text><Text style={styles.valueNegro}>{clientData.phone}</Text></View>
            <View style={styles.clientRow}><Text style={styles.labelGris}>Web:</Text><Text style={styles.valueNegro}>{clientData.website}</Text></View>
          </View>

          <View style={styles.gridColRight}>
            <Text style={styles.sectionTitle}>Logística de Entrega</Text>
            <View style={{ gap: 4, fontSize: 9 }}>
              <Text><Text style={{ color: '#94a3b8' }}>Cajas/Pallets:</Text> {quantity} / {data.pallets || 'N/A'}</Text>
              <Text><Text style={{ color: '#94a3b8' }}>Peso:</Text> {data.weight_kg} Kg</Text>
              <Text><Text style={{ color: '#94a3b8' }}>Incoterm:</Text> <Text style={{ color: '#234d23', fontWeight: 'bold' }}>{incotermDisplay}</Text></Text>
              <Text><Text style={{ color: '#94a3b8' }}>Modo:</Text> {data.mode === 'AIR' ? 'Aéreo' : 'Marítimo'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 3.5 }]}>Producto / Especificaciones</Text>
          <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Cantidad</Text>
          <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Precio Unit.</Text>
          <Text style={[styles.th, { flex: 1.5, textAlign: 'right', color: '#234d23' }]}>TOTAL</Text>
        </View>

        <View style={styles.tableRow}>
          <View style={{ flex: 3.5 }}>
            <Text style={styles.tdMain}>{pName} {pVariety}</Text>
            <Text style={styles.tdSpecs}>Cal: {pCaliber} • Color: {pColor} • Brix: {pBrix}</Text>
          </View>
          <Text style={{ flex: 1, textAlign: 'center' }}>{quantity} Cajas</Text>
          {/* Aquí mostramos el unitario real (Total / Cajas) */}
          <Text style={{ flex: 1.2, textAlign: 'right' }}>$ {unitPrice.toFixed(2)}</Text>
          {/* Aquí el total de la base de datos */}
          <Text style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', color: '#234d23' }}>$ {finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>

        <View style={styles.bottomContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ maxWidth: '60%' }}>
              <Text style={styles.termsTitle}>Términos y Condiciones</Text>
              <Text style={{ fontSize: 8, color: '#64748b' }}>• Validez: Sujeto a variaciones de Bunker/Fuel Surcharge.</Text>
              <Text style={{ fontSize: 8, color: '#64748b' }}>• Logística: Incluye trámites fitosanitarios y pre-enfriamiento.</Text>
              <Text style={{ fontSize: 8, color: '#64748b' }}>• Pago: Transferencia Bancaria Swift contra entrega de AWB.</Text>
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

// 4. API HANDLER
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id) return res.status(400).send("ID Missing");

  try {
    const { data, error } = await supabaseAdmin
      .from("quotes")
      .select("*, clients(*), products(*)")
      .eq("id", id)
      .single();

    if (error || !data) return res.status(404).send("Quote not found");

    const stream = await renderToStream(<PdfTemplate data={data} />);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=cotizacion.pdf');
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
}