import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Esta ruta corre en el servidor (Next.js Route Handler).
// Usa la SERVICE_ROLE_KEY — una clave que puede crear usuarios y saltarse las
// políticas RLS — que NUNCA debe enviarse al navegador. Al mantenerla aquí,
// en el servidor, está a salvo.

// Contraseña de administrador para proteger esta ruta.
// Cámbiala por algo tuyo y guárdala como variable de entorno en Vercel.
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'deca-admin-2026';

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar que quien llama conoce el secreto de admin
    const { adminSecret, orgName, orgSlug, userEmail, userPassword, modules } = await req.json();

    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    if (!orgName || !orgSlug || !userEmail || !userPassword) {
      return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
    }

    // 2. Cliente con permisos de administrador (solo en el servidor)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 3. Crear la organización
    const modulosActivos = modules ?? ['deca', 'flota'];
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert([{ name: orgName, slug: orgSlug, modules: modulosActivos }])
      .select('id')
      .single();

    if (orgError) throw new Error(`Error al crear organización: ${orgError.message}`);

    // 4. Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true, // No requiere confirmación por email
    });

    if (authError) {
      // Si falla la creación del usuario, borramos la org para no dejar basura
      await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      throw new Error(`Error al crear usuario: ${authError.message}`);
    }

    // 5. Asignar el usuario a la organización
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert([{ user_id: authData.user.id, org_id: org.id, role: 'member' }]);

    if (memberError) {
      // Si falla la asignación, limpiamos todo
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      throw new Error(`Error al asignar usuario a organización: ${memberError.message}`);
    }

    return NextResponse.json({
      success: true,
      orgId: org.id,
      userId: authData.user.id,
      message: `Organización "${orgName}" y usuario "${userEmail}" creados correctamente.`
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
