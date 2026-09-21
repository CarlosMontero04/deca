import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Da de alta un transportista directamente en una organización desde el
// panel de admin, sin tener que entrar como ese cliente y usar Gestión de Flota.
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'deca-admin-2026';

export async function POST(req: NextRequest) {
  try {
    const { adminSecret, orgId, companyName, cif, address, phone, email } = await req.json();

    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    if (!orgId || !companyName || !cif) {
      return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // La tabla carriers exige un user_id (quién lo dio de alta) — como el
    // admin no es un usuario de esa organización, usamos el primer miembro
    // ya asociado como "propietario" del registro.
    const { data: member, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .eq('org_id', orgId)
      .limit(1)
      .maybeSingle();

    if (memberError) throw new Error(memberError.message);
    if (!member) {
      return NextResponse.json({ error: 'Esta organización todavía no tiene ningún usuario asociado — añade uno primero.' }, { status: 400 });
    }

    const { data: carrier, error } = await supabaseAdmin
      .from('carriers')
      .insert([{
        org_id: orgId,
        user_id: member.user_id,
        company_name: companyName,
        cif,
        address: address || null,
        phone: phone || null,
        email: email || null,
      }])
      .select('id, company_name, cif, address, phone, email')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      carrier,
      message: `Transportista "${companyName}" asociado correctamente.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
