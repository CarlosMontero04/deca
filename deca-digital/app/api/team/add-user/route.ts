import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/app/utils/requireOrgAdmin';

// Da de alta a un nuevo usuario DENTRO de la organización de quien llama
// (nunca en otra). El admin le asigna una contraseña inicial a mano, igual
// que hace Carlos desde su panel general — no depende de que exista un
// flujo de invitación por email.
export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin();
  if ('error' in auth) return auth.error;
  const { orgId, supabaseAdmin } = auth;

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Faltan el email o la contraseña.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: `Error al crear el usuario: ${authError.message}` }, { status: 400 });
    }

    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert([{ user_id: authData.user.id, org_id: orgId, role: 'member' }]);

    if (memberError) {
      // Si falla la asociación, no dejamos un usuario huérfano sin organización
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: `Error al asociar el usuario: ${memberError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      member: { user_id: authData.user.id, email, role: 'member' },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
