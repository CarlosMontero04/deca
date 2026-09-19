import { SupabaseClient } from '@supabase/supabase-js';
import { OrgBranding } from './pdfGenerator';

/**
 * Carga los datos de marca de la organización del usuario actual desde
 * company_profile. Se usa antes de generar un PDF para que el documento
 * salga con la identidad del cliente, no con la de OPERPAL.
 *
 * El logo se guarda como URL pública en Storage. Lo descargamos aquí y lo
 * convertimos a base64 para que jsPDF pueda incrustarlo en el PDF sin
 * hacer peticiones externas desde el generador.
 *
 * Si la organización no tiene perfil o no tiene logo, devuelve undefined —
 * el generador usará los valores por defecto de OPERPAL.
 */
export async function loadOrgBranding(supabase: SupabaseClient): Promise<OrgBranding | undefined> {
  const { data } = await supabase
    .from('company_profile')
    .select('company_name, cif, address, phone, email, logo_url, logo_width_px, logo_height_px')
    .limit(1)
    .maybeSingle();

  if (!data?.company_name) return undefined;

  // Si tiene logo, lo descargamos y convertimos a base64
  let logoBase64: string | undefined;
  let logoWidthPx: number | undefined = data.logo_width_px ?? undefined;
  let logoHeightPx: number | undefined = data.logo_height_px ?? undefined;

  let logoFormat: 'PNG' | 'JPEG' | undefined;

  if (data.logo_url) {
    try {
      const res = await fetch(data.logo_url);
      if (res.ok) {
        // Detectar formato por Content-Type o por la URL
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('jpeg') || contentType.includes('jpg') ||
            data.logo_url.toLowerCase().match(/\.(jpg|jpeg)/)) {
          logoFormat = 'JPEG';
        } else {
          logoFormat = 'PNG';
        }
        const arrayBuffer = await res.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        bytes.forEach(b => { binary += String.fromCharCode(b); });
        logoBase64 = btoa(binary);
      }
    } catch {
      // Si falla la descarga del logo, seguimos sin él
      logoBase64 = undefined;
      logoFormat = undefined;
    }
  }

  return {
    companyName:  data.company_name,
    cif:          data.cif      ?? undefined,
    address:      data.address  ?? undefined,
    phone:        data.phone    ?? undefined,
    email:        data.email    ?? undefined,
    logoBase64,
    logoFormat,
    logoWidthPx,
    logoHeightPx,
  };
}
