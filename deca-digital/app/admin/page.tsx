"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { Building2, UserPlus, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

// Esta pantalla es solo para ti — no aparece en ningún menú y no se puede
// acceder desde la app. La URL es /admin y necesita la contraseña de admin
// que defines en ADMIN_SECRET en Vercel.
export default function AdminPanel() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Formulario
  const [adminSecret, setAdminSecret] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [moduloCarga, setModuloCarga] = useState(false);

  // Organizaciones existentes
  const [orgs, setOrgs] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);

      // Cargamos las organizaciones para mostrar el estado actual
      const { data } = await supabase
        .from('organizations')
        .select('id, name, slug, modules, created_at')
        .order('created_at');
      setOrgs(data || []);
    };
    init();
  }, []);

  // Auto-genera el slug desde el nombre
  const handleOrgNameChange = (v: string) => {
    setOrgName(v);
    setOrgSlug(v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const modules = moduloCarga
        ? ['deca', 'carga', 'flota']
        : ['deca', 'flota'];

      const res = await fetch('/api/admin/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSecret, orgName, orgSlug, userEmail, userPassword, modules }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setResult({ ok: false, msg: data.error });
      } else {
        setResult({ ok: true, msg: data.message });
        // Resetear el formulario y actualizar la lista
        setOrgName(''); setOrgSlug(''); setUserEmail(''); setUserPassword('');
        setModuloCarga(false);
        const { data: newOrgs } = await supabase
          .from('organizations')
          .select('id, name, slug, modules, created_at')
          .order('created_at');
        setOrgs(newOrgs || []);
      }
    } catch (err: any) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-slate-400 hover:text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#2A1670]" />
            Panel de Administración
          </h1>
        </div>

        {/* Formulario de alta */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            Dar de alta un nuevo cliente
          </h2>
          <p className="text-xs text-slate-500">
            Crea la organización y el primer usuario en un solo paso. El usuario podrá iniciar sesión inmediatamente.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña de administrador</label>
              <input
                required type="password" value={adminSecret}
                onChange={e => setAdminSecret(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                placeholder="La que tienes en ADMIN_SECRET en Vercel"
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Datos de la empresa</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre de la empresa</label>
                  <input
                    required value={orgName}
                    onChange={e => handleOrgNameChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                    placeholder="Ej. Transportes García S.L."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Slug (URL)</label>
                  <input
                    required value={orgSlug}
                    onChange={e => setOrgSlug(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 font-mono"
                    placeholder="transportes-garcia"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Módulos contratados</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked disabled className="rounded" />
                    DeCA Digital <span className="text-slate-400 text-xs">(siempre incluido)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked disabled className="rounded" />
                    Gestión de Flota <span className="text-slate-400 text-xs">(siempre incluido)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={moduloCarga} onChange={e => setModuloCarga(e.target.checked)} className="rounded" />
                    Órdenes de Carga <span className="text-slate-400 text-xs">(opcional)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Primer usuario</p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  required type="email" value={userEmail}
                  onChange={e => setUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                  placeholder="usuario@empresa.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña inicial</label>
                <div className="relative">
                  <input
                    required type={showPassword ? 'text' : 'password'} value={userPassword}
                    onChange={e => setUserPassword(e.target.value)}
                    minLength={8}
                    className="w-full px-3 py-2 pr-10 border rounded-lg text-sm text-slate-900"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">El cliente la cambiará desde "Mi Cuenta" al entrar.</p>
              </div>
            </div>

            {result && (
              <div className={`flex items-start gap-2 p-3 rounded-xl text-sm border ${result.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                {result.ok
                  ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                }
                {result.msg}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-[#2A1670] hover:bg-[#1e1050] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
              <UserPlus className="w-4 h-4" />
              {loading ? 'Creando...' : 'Crear empresa y usuario'}
            </button>
          </form>
        </div>

        {/* Lista de organizaciones existentes */}
        {orgs.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-bold text-slate-800 text-sm">Organizaciones activas ({orgs.length})</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3 text-left">Empresa</th>
                  <th className="p-3 text-left">Slug</th>
                  <th className="p-3 text-left">Módulos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orgs.map(org => (
                  <tr key={org.id}>
                    <td className="p-3 font-semibold text-slate-800">{org.name}</td>
                    <td className="p-3 font-mono text-slate-500 text-xs">{org.slug}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(org.modules || []).map((m: string) => (
                          <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-semibold">{m}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
