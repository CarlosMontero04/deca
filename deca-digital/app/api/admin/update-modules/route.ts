import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Actualiza los módulos contratados (deca, flota, carga) de una organización
// ya existente, desde el panel de admin.
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'deca-admin-2026';
const VALID_MODULES = ['deca', 'flota', 'carga'];

export async function POST(req: NextRequest) {
  try {
    const { adminSecret, orgId, modules } = await req.json();

    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    if (!orgId || !Array.isArray(modules)) {
      return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
    }

    // deca y flota van siempre incluidos, aunque no lleguen marcados
    const cleanModules = Array.from(new Set([
      'deca', 'flota',
      ...modules.filter((m: string) => VALID_MODULES.includes(m)),
    ]));

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .update({ modules: cleanModules })
      .eq('id', orgId)
      .select('id, name, modules')
      .single();

    if (error) throw new Error(error.message);
    if (!org) return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 });

    return NextResponse.json({
      success: true,
      org,
      message: `Módulos de "${org.name}" actualizados correctamente.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
