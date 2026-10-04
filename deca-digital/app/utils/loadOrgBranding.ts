import { SupabaseClient } from '@supabase/supabase-js';
import { OrgBranding } from './pdfGenerator';

/**
 * Carga los datos de marca para el PDF: nombre, CIF, dirección, teléfono,
 * email, colores corporativos y logo son datos de identidad de la empresa.
 * Si la ficha de este usuario no tiene alguno de ellos, se completa con el
 * de cualquier otro miembro de su misma organización que sí lo tenga, para
 * que el PDF nunca pierda la identidad real de la empresa por ese motivo
 * (por ejemplo, un miembro que nunca ha rellenado su propia ficha).
 *
 * El logo se guarda como URL pública en Storage. Lo descargamos aquí y lo
 * convertimos a base64 para que jsPDF pueda incrustarlo en el PDF sin
 * hacer peticiones externas desde el generador.
 *
 * Si ni este usuario ni ningún otro miembro de su organización tiene nombre
 * de empresa, devuelve undefined — el generador usará los valores por
 * defecto de OPERPAL como último recurso.
 */
export async function loadOrgBranding(supabase: SupabaseClient): Promise<OrgBranding | undefined> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return undefined;

  const { data } = await supabase
    .from('company_profile')
    .select('org_id, company_name, cif, address, phone, email, logo_url, logo_width_px, logo_height_px, primary_color, accent_color')
    .eq('user_id', user.id)
    .maybeSingle();

  // Nombre, CIF, dirección, teléfono, email y colores corporativos: si la
  // ficha propia no tiene alguno de ellos, se completa (campo a campo) con
  // el de cualquier otro miembro de la misma organización que sí lo tenga.
  let companyName = data?.company_name;
  let cif = data?.cif;
  let address = data?.address;
  let phone = data?.phone;
  let email = data?.email;
  let primaryColor = data?.primary_color;
  let accentColor = data?.accent_color;

  if ((!companyName || !phone || !email || !primaryColor || !accentColor) && data?.org_id) {
    const { data: otraFichaDatos } = await supabase
      .from('company_profile')
      .select('company_name, cif, address, phone, email, primary_color, accent_color')
      .eq('org_id', data.org_id)
      .order('company_name', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!companyName && otraFichaDatos?.company_name) {
      companyName = otraFichaDatos.company_name;
      cif = otraFichaDatos.cif;
      address = otraFichaDatos.address;
    }
    if (!phone && otraFichaDatos?.phone) phone = otraFichaDatos.phone;
    if (!email && otraFichaDatos?.email) email = otraFichaDatos.email;
    if (!primaryColor && otraFichaDatos?.primary_color) primaryColor = otraFichaDatos.primary_color;
    if (!accentColor && otraFichaDatos?.accent_color) accentColor = otraFichaDatos.accent_color;
  }

  if (!companyName) return undefined;

  // Si este usuario no tiene logo propio, usamos el de cualquier otro
  // miembro de la misma organización que sí lo tenga.
  let logoUrl = data?.logo_url;
  let logoWidthPxFallback = data?.logo_width_px;
  let logoHeightPxFallback = data?.logo_height_px;
  if (!logoUrl && data?.org_id) {
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
    companyName,
    cif:           cif    ?? undefined,
    address:       address ?? undefined,
    phone:         phone ?? undefined,
    email:         email ?? undefined,
    logoBase64,
    logoFormat,
    logoWidthPx,
    logoHeightPx,
    primaryColor:  primaryColor ?? undefined,
    accentColor:   accentColor  ?? undefined,
  };
}
