import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Devuelve, para una organización dada, sus usuarios asociados (con email,
// obtenido de Supabase Auth) y sus transportistas — usado por el panel de
// admin para desplegar el detalle de una organización.
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'deca-admin-2026';

export async function POST(req: NextRequest) {
  try {
    const { adminSecret, orgId } = await req.json();

    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Falta el orgId.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const [{ data: memberRows, error: memberError }, { data: carriers, error: carrierError }] = await Promise.all([
      supabaseAdmin.from('organization_members').select('user_id, role').eq('org_id', orgId),
      supabaseAdmin.from('carriers').select('id, company_name, cif, address, phone, email').eq('org_id', orgId).order('company_name'),
    ]);

    if (memberError) throw new Error(memberError.message);
    if (carrierError) throw new Error(carrierError.message);

    // organization_members solo guarda el user_id — el email vive en
    // Supabase Auth, así que lo resolvemos aparte con el service role.
    const members = await Promise.all((memberRows ?? []).map(async (m) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        email: error || !data?.user ? '(usuario no encontrado)' : data.user.email,
      };
    }));

    return NextResponse.json({ members, carriers: carriers ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
