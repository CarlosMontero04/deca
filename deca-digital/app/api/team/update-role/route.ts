import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/app/utils/requireOrgAdmin';

// Asciende/degrada a un usuario DENTRO de la organización de quien llama.
// Nunca deja la organización sin ningún admin: si el cambio degradaría al
// último admin (incluido el propio admin degradándose a sí mismo), se
// rechaza con un mensaje claro.
export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin();
  if ('error' in auth) return auth.error;
  const { orgId, supabaseAdmin } = auth;

  try {
    const { userId, role } = await req.json();

    if (!userId || (role !== 'admin' && role !== 'member')) {
      return NextResponse.json({ error: 'Faltan campos obligatorios o el rol no es válido.' }, { status: 400 });
    }

    const { data: target } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, org_id, role')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ error: 'Ese usuario no pertenece a tu organización.' }, { status: 404 });
    }

    // Si se degrada a un admin, nos aseguramos de que quede al menos otro
    if (target.role === 'admin' && role === 'member') {
      const { count } = await supabaseAdmin
        .from('organization_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'admin');

      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'No puedes quitar el rol de admin al último admin de la organización. Asciende a otro usuario primero.' }, { status: 400 });
      }
    }

    const { error } = await supabaseAdmin
      .from('organization_members')
      .update({ role })
      .eq('user_id', userId)
      .eq('org_id', orgId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
