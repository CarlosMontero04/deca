import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Asciende/degrada a un usuario como admin de su organización. Un admin de
// organización ve y gestiona los DeCA y Órdenes de Carga de TODOS los
// usuarios de su empresa; un "member" normal solo ve y gestiona los suyos
// (ver política RLS en decas / ordenes_carga, que depende de esta columna).
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'deca-admin-2026';

export async function POST(req: NextRequest) {
  try {
    const { adminSecret, userId, orgId, role } = await req.json();

    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    if (!userId || !orgId || (role !== 'admin' && role !== 'member')) {
      return NextResponse.json({ error: 'Faltan campos obligatorios o el rol no es válido.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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
