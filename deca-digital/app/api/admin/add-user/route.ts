import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'deca-admin-2026';

export async function POST(req: NextRequest) {
  try {
    const { adminSecret, orgId, userEmail, userPassword } = await req.json();

    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    if (!orgId || !userEmail || !userPassword) {
      return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verificar que la organización existe
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 });
    }

    // Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true,
    });

    if (authError) throw new Error(`Error al crear usuario: ${authError.message}`);

    // Asignar a la organización
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert([{ user_id: authData.user.id, org_id: orgId, role: 'member' }]);

    if (memberError) {
      // Limpieza si falla la asignación
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Error al asignar usuario a organización: ${memberError.message}`);
    }

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
      message: `Usuario "${userEmail}" añadido a "${org.name}" correctamente.`
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
