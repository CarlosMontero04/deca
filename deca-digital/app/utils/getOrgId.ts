import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Devuelve el org_id de la organización a la que pertenece el usuario actual.
 * Se usa antes de cualquier insert para asegurarse de que el nuevo registro
 * queda asignado a la organización correcta.
 *
 * Lanza un error si el usuario no pertenece a ninguna organización — esto
 * no debería pasar en producción (el alta controlada lo garantiza), pero
 * sirve de red de seguridad durante el desarrollo.
 */
export async function getOrgId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('org_id')
    .single();

  if (error || !data?.org_id) {
    throw new Error('No se encontró organización para este usuario. Contacta con el administrador.');
  }

  return data.org_id;
}
