import { schedule } from '@netlify/functions';
import axios from 'axios';

const cronHandler = async () => {
  console.log("--- DISPARANDO MINADO AUTOMÁTICO (MADRID/BARCELONA) ---");
  
  try {
    // Obtenemos la URL base de tu proyecto
    const siteUrl = process.env.URL || "https://fresh-food-tracker.netlify.app";
    
    // Llamamos a la Background Function que ya configuramos con 20 leads y el modelo validado.
    // Usamos axios o fetch para disparar y no esperar (fire and forget).
    await axios.post(`${siteUrl}/.netlify/functions/mineLeads-background`, {
      location: "Madrid y Barcelona, España",
      product: "Piña Premium"
    });

    console.log("--- SEÑAL DE MINADO ENVIADA A BACKGROUND FUNCTION ---");
    return { statusCode: 202 }; // Accepted
  } catch (err: any) {
    console.error("ERROR AL DISPARAR EL MINADO:", err.message);
    return { statusCode: 500 };
  }
};

// Lunes y Miércoles a las 8:00 AM
export const handler = schedule("0 8 * * 1,3", cronHandler);