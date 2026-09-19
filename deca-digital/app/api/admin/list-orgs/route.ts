import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'deca-admin-2026';

export async function POST(req: NextRequest) {
  try {
    const { adminSecret } = await req.json();

    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    // Service role para saltarse RLS y ver TODAS las organizaciones
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: orgs, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug, modules, created_at')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ orgs: orgs ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
