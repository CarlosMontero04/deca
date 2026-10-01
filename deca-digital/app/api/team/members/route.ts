import { NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/app/utils/requireOrgAdmin';

// Lista los usuarios de la organización del admin que ha hecho la petición.
// La organización nunca se recibe del cliente: la calcula requireOrgAdmin()
// a partir de la sesión de quien llama.
export async function GET() {
  const auth = await requireOrgAdmin();
  if ('error' in auth) return auth.error;
  const { orgId, user, supabaseAdmin } = auth;

  try {
    const { data: memberRows, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role')
      .eq('org_id', orgId);

    if (memberError) throw new Error(memberError.message);

    const members = await Promise.all((memberRows ?? []).map(async (m) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        email: error || !data?.user ? '(usuario no encontrado)' : data.user.email,
      };
    }));

    return NextResponse.json({ members, currentUserId: user.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
