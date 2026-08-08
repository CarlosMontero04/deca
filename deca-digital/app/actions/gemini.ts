"use server";

import { GoogleGenAI } from '@google/genai';

export async function parseAlbaranWithAI(text: string, base64Image?: string, mimeType?: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("Falta la API Key de Gemini en las variables de entorno del servidor.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Eres un experto en normativa de transporte de mercancías por carretera en España (DeCA / BOE). Analiza la siguiente información de albarán o nota de entrega (texto y/o documento adjunto) y extrae estructuradamente en JSON los datos para el Documento de Control Administrativo (DeCA). 
Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta:
{
  "carrier": { "companyName": "", "cif": "", "address": "", "driverName": "", "driverDni": "", "tractorPlate": "", "trailerPlate": "", "phone": "" },
  "contractualShipper": { "companyName": "", "cif": "", "address": "", "contactName": "" },
  "shipments": [ { "trackingNumber": "", "originAddress": "", "originCity": "", "originPostalCode": "", "destinationAddress": "", "destinationCity": "", "destinationPostalCode": "", "goodsDescription": "", "goodsCategory": "General", "packageCount": 10, "grossWeightKg": 1500, "shipperName": "", "consigneeName": "" } ]
}
Texto a analizar: ${text || '(sin texto, utiliza el documento adjunto)'}`;

    let contents: any = prompt;
    
    if (base64Image && mimeType) {
      contents = [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: base64Image, mimeType: mimeType } }
          ]
        }
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: contents,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    const parsedData = JSON.parse(responseText);
    
    return { success: true, data: parsedData };

  } catch (error: any) {
    console.error("Error procesando con Gemini:", error);
    return { success: false, error: error.message };
  }
}