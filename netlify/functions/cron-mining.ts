import { schedule } from '@netlify/functions';
import axios from 'axios';

// 🚀 ENRUTADOR INTELIGENTE DE MERCADOS Y PRODUCTOS
const CAMPAIGNS = [
  {
    product: "Piña Premium (Exclusivo Importación Aérea)",
    locations: [
      "Madrid, España", "Barcelona, España", "París, Francia", 
      "Milán, Italia", "Fráncfort, Alemania", "Ámsterdam, Países Bajos"
    ]
  },
  {
    product: "Pitahaya / Dragon Fruit (Exclusivo Importación Aérea)",
    locations: [
      "Londres, Reino Unido", "Madrid, España", "París, Francia",
      "Berlín, Alemania", "Zúrich, Suiza", "Estocolmo, Suecia"
    ]
  },
  {
    product: "Café Geisha Especial de Panamá (Importación Aérea)",
    locations: [
      // 🌏 Hubs Asiáticos (Máximos compradores mundiales de Geisha)
      "Tokio, Japón", "Seúl, Corea del Sur", "Taipéi, Taiwán", 
      "Shanghái, China", "Hong Kong", "Kioto, Japón",
      // 🌍 Hubs Europeos Premium
      "Londres, Reino Unido", "Copenhague, Dinamarca", "Múnich, Alemania"
    ]
  }
];

const cronHandler = async () => {
  // 1. Elegimos un rubro al azar para diversificar la semana
  const randomCampaignIndex = Math.floor(Math.random() * CAMPAIGNS.length);
  const selectedCampaign = CAMPAIGNS[randomCampaignIndex];

  // 2. Elegimos una ciudad estratégica basada en ese rubro
  const randomLocationIndex = Math.floor(Math.random() * selectedCampaign.locations.length);
  const selectedLocation = selectedCampaign.locations[randomLocationIndex];

  console.log(`--- ✈️ DISPARANDO MINADO AUTOMÁTICO (SOLO CARGA AÉREA) ---`);
  console.log(`📦 Producto Estratégico: ${selectedCampaign.product}`);
  console.log(`📍 Destino Seleccionado: ${selectedLocation}`);
  
  try {
    const siteUrl = process.env.URL || "https://fresh-food-tracker.netlify.app";
    
    // 3. Disparamos la señal de minado
    await axios.post(`${siteUrl}/.netlify/functions/mineLeads-background`, {
      location: selectedLocation,
      product: selectedCampaign.product
    });

    console.log(`--- ✅ SEÑAL ENVIADA A BACKGROUND FUNCTION ---`);
    return { statusCode: 202 };
  } catch (err: any) {
    console.error("❌ ERROR AL DISPARAR EL MINADO:", err.message);
    return { statusCode: 500 };
  }
};

// ⏱️ EJECUCIÓN: De Lunes a Viernes a las 8:00 AM UTC
export const handler = schedule("0 8 * * 1-5", cronHandler);