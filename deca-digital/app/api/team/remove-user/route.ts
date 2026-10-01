import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/app/utils/requireOrgAdmin';

// Quita a un usuario de la organización de quien llama. Esto SOLO revoca su
// acceso (se borra su fila de organization_members): no se borra su cuenta
// ni sus DeCA/Órdenes de Carga ya creados, que la organización sigue
// obligada a conservar aunque esa persona ya no trabaje allí — el admin
// sigue viéndolos con normalidad.
export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin();
  if ('error' in auth) return auth.error;
  const { orgId, user, supabaseAdmin } = auth;

  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Falta el userId.' }, { status: 400 });
    }
    if (userId === user.id) {
      return NextResponse.json({ error: 'No puedes quitarte a ti mismo de la organización. Pide a otro admin que lo haga.' }, { status: 400 });
    }

    // Comprobamos que el usuario a quitar pertenece REALMENTE a la organización
    // de quien llama, nunca a otra.
    const { data: target } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, org_id')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ error: 'Ese usuario no pertenece a tu organización.' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('user_id', userId)
      .eq('org_id', orgId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
