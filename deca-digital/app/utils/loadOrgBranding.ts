import { SupabaseClient } from '@supabase/supabase-js';
import { OrgBranding } from './pdfGenerator';

/**
 * Carga los datos de marca para el PDF: nombre, CIF, dirección, teléfono y
 * email son los de la ficha del propio usuario que está generando el
 * documento (cada administrador puede tener los suyos). El logo es la
 * excepción: si este usuario no ha subido uno, se usa el de cualquier otro
 * administrador de su misma organización que sí lo tenga, para que el PDF
 * nunca se quede sin el logo de la empresa por ese motivo.
 *
 * El logo se guarda como URL pública en Storage. Lo descargamos aquí y lo
 * convertimos a base64 para que jsPDF pueda incrustarlo en el PDF sin
 * hacer peticiones externas desde el generador.
 *
 * Si el usuario no tiene perfil de empresa, devuelve undefined — el
 * generador usará los valores por defecto de OPERPAL.
 */
export async function loadOrgBranding(supabase: SupabaseClient): Promise<OrgBranding | undefined> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return undefined;

  const { data } = await supabase
    .from('company_profile')
    .select('org_id, company_name, cif, address, phone, email, logo_url, logo_width_px, logo_height_px, primary_color, accent_color')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data?.company_name) return undefined;

  // Si este usuario no tiene logo propio, usamos el de cualquier otro
  // administrador de la misma organización que sí lo tenga.
  let logoUrl = data.logo_url;
  let logoWidthPxFallback = data.logo_width_px;
  let logoHeightPxFallback = data.logo_height_px;
  if (!logoUrl && data.org_id) {
    const { data: otraFicha } = await supabase
      .from('company_profile')
      .select('logo_url, logo_width_px, logo_height_px')
      .eq('org_id', data.org_id)
      .order('logo_url', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (otraFicha?.logo_url) {
      logoUrl = otraFicha.logo_url;
      logoWidthPxFallback = otraFicha.logo_width_px;
      logoHeightPxFallback = otraFicha.logo_height_px;
    }
  }

  // Si tiene logo (propio o el de otro admin de su organización), lo
  // descargamos y convertimos a base64
  let logoBase64: string | undefined;
  const logoWidthPx: number | undefined = logoWidthPxFallback ?? undefined;
  const logoHeightPx: number | undefined = logoHeightPxFallback ?? undefined;

  let logoFormat: 'PNG' | 'JPEG' | undefined;

  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      if (res.ok) {
        // Detectar formato por Content-Type o por la URL
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('jpeg') || contentType.includes('jpg') ||
            logoUrl.toLowerCase().match(/\.(jpg|jpeg)/)) {
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
    companyName:   data.company_name,
    cif:           data.cif           ?? undefined,
    address:       data.address       ?? undefined,
    phone:         data.phone         ?? undefined,
    email:         data.email         ?? undefined,
    logoBase64,
    logoFormat,
    logoWidthPx,
    logoHeightPx,
    primaryColor:  data.primary_color ?? undefined,
    accentColor:   data.accent_color  ?? undefined,
  };
}
