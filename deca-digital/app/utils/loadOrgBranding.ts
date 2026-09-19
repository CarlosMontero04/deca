import { SupabaseClient } from '@supabase/supabase-js';
import { OrgBranding } from './pdfGenerator';

/**
 * Carga los datos de marca de la organización del usuario actual desde
 * company_profile. Se usa antes de generar un PDF para que el documento
 * salga con la identidad del cliente, no con la de OPERPAL.
 *
 * Si la organización no tiene perfil aún (o no tiene logo subido),
 * devuelve null — en ese caso el generador usará los valores por defecto
 * de OPERPAL, lo cual es correcto para OPERPAL mismo y evita romper nada
 * durante la transición para clientes nuevos que todavía no han configurado
 * su perfil.
 */
export async function loadOrgBranding(supabase: SupabaseClient): Promise<OrgBranding | undefined> {
  const { data } = await supabase
    .from('company_profile')
    .select('company_name, cif, address, phone, email, logo_base64, logo_width_px, logo_height_px')
    .single();

  if (!data?.company_name) return undefined;

  return {
    companyName: data.company_name,
    cif:         data.cif        ?? undefined,
    address:     data.address    ?? undefined,
    phone:       data.phone      ?? undefined,
    email:       data.email      ?? undefined,
    logoBase64:  data.logo_base64   ?? undefined,
    logoWidthPx: data.logo_width_px ?? undefined,
    logoHeightPx: data.logo_height_px ?? undefined,
  };
}
