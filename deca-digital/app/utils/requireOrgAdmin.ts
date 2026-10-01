import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

/**
 * Comprueba, a partir de la sesión (cookies) de quien hace la petición, que
 * es admin de su organización — y devuelve esa organización ya calculada,
 * nunca la que venga en el body de la petición. Así un admin de una empresa
 * no puede, ni por error ni a propósito, gestionar usuarios de otra.
 *
 * Uso en una ruta API:
 *   const auth = await requireOrgAdmin();
 *   if ('error' in auth) return auth.error;
 *   const { user, orgId, supabaseAdmin } = auth;
 */
export async function requireOrgAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'No hay sesión activa.' }, { status: 401 }) } as const;
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return { error: NextResponse.json({ error: 'No perteneces a ninguna organización.' }, { status: 403 }) } as const;
  }
  if (membership.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Solo el admin de tu organización puede gestionar usuarios.' }, { status: 403 }) } as const;
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  return { user, orgId: membership.org_id as string, supabaseAdmin } as const;
}
