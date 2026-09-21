"use client";

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { Building2, UserPlus, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff, RefreshCw, Users, ChevronDown, ChevronUp, Truck, Settings2, Plus } from 'lucide-react';

// Esta pantalla es solo para ti — no aparece en ningún menú y no se puede
// acceder desde la app. La URL es /admin y necesita la contraseña de admin
// que defines en ADMIN_SECRET en Vercel.
export default function AdminPanel() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Secreto (se reutiliza en ambas acciones)
  const [adminSecret, setAdminSecret] = useState('');

  // ──────────────────────────────────────────────
  // Sección 1: Nuevo cliente (org + primer usuario)
  // ──────────────────────────────────────────────
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [moduloCarga, setModuloCarga] = useState(false);

  // ──────────────────────────────────────────────
  // Sección 2: Añadir usuario a org existente
  // ──────────────────────────────────────────────
  const [addUserOrgId, setAddUserOrgId] = useState('');
  const [addUserEmail, setAddUserEmail] = useState('');
  const [addUserPassword, setAddUserPassword] = useState('');
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);
  const [addUserResult, setAddUserResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [addUserLoading, setAddUserLoading] = useState(false);

  // ──────────────────────────────────────────────
  // Organizaciones (cargadas vía API con service role)
  // ──────────────────────────────────────────────
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  // ──────────────────────────────────────────────
  // Sección 3: Detalle de organización (usuarios asociados,
  // transportistas y módulos contratados) — se carga bajo demanda
  // al desplegar una fila de la tabla de organizaciones.
  // ──────────────────────────────────────────────
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
  const [orgDetails, setOrgDetails] = useState<Record<string, { members: any[]; carriers: any[] }>>({});
  const [orgDetailsLoading, setOrgDetailsLoading] = useState<string | null>(null);

  // Edición de módulos contratados
  const [editingModulesOrgId, setEditingModulesOrgId] = useState<string | null>(null);
  const [editingModules, setEditingModules] = useState<string[]>([]);
  const [modulesSaving, setModulesSaving] = useState(false);

  // Alta de transportista directamente desde el panel de admin
  const [carrierForm, setCarrierForm] = useState({ company_name: '', cif: '', address: '', phone: '', email: '' });
  const [carrierSaving, setCarrierSaving] = useState(false);
  const [carrierResult, setCarrierResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchOrgs = useCallback(async (secret: string) => {
    if (!secret) return;
    setOrgsLoading(true);
    try {
      const res = await fetch('/api/admin/list-orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSecret: secret }),
      });
      const data = await res.json();
      if (res.ok) setOrgs(data.orgs ?? []);
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  // Solo el email de admin puede ver esta página — doble barrera junto al ADMIN_SECRET de las APIs
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'carlosmonteroh04@gmail.com';

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      if (session.user.email !== ADMIN_EMAIL) { router.push('/'); return; }
      setUser(session.user);
    };
    init();
  }, []);

  // Auto-genera el slug desde el nombre
  const handleOrgNameChange = (v: string) => {
    setOrgName(v);
    setOrgSlug(
      v.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    );
  };

  // Cuando cambia el secreto, cargamos las orgs automáticamente
  const handleSecretBlur = () => {
    if (adminSecret) fetchOrgs(adminSecret);
  };

  // ─── Crear nueva empresa ───────────────────────
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
        // Resetear el formulario de nueva empresa
        setOrgName(''); setOrgSlug(''); setUserEmail(''); setUserPassword('');
        setModuloCarga(false);
        // Refrescar lista usando la API (service role, ve TODAS las orgs)
        await fetchOrgs(adminSecret);
      }
    } catch (err: any) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ─── Añadir usuario a org existente ───────────
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserLoading(true);
    setAddUserResult(null);

    try {
      const res = await fetch('/api/admin/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminSecret,
          orgId: addUserOrgId,
          userEmail: addUserEmail,
          userPassword: addUserPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setAddUserResult({ ok: false, msg: data.error });
      } else {
        setAddUserResult({ ok: true, msg: data.message });
        setAddUserOrgId(''); setAddUserEmail(''); setAddUserPassword('');
      }
    } catch (err: any) {
      setAddUserResult({ ok: false, msg: err.message });
    } finally {
      setAddUserLoading(false);
    }
  };

  // ─── Desplegar/plegar el detalle de una organización ───
  const toggleExpandOrg = async (orgId: string) => {
    if (expandedOrgId === orgId) { setExpandedOrgId(null); return; }
    setExpandedOrgId(orgId);
    setEditingModulesOrgId(null);
    setCarrierResult(null);
    setCarrierForm({ company_name: '', cif: '', address: '', phone: '', email: '' });
    if (!orgDetails[orgId]) {
      setOrgDetailsLoading(orgId);
      try {
        const res = await fetch('/api/admin/org-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminSecret, orgId }),
        });
        const data = await res.json();
        if (res.ok) {
          setOrgDetails(prev => ({ ...prev, [orgId]: { members: data.members ?? [], carriers: data.carriers ?? [] } }));
        }
      } finally {
        setOrgDetailsLoading(null);
      }
    }
  };

  // ─── Editar módulos contratados de una organización ───
  const startEditModules = (org: any) => {
    setEditingModulesOrgId(org.id);
    setEditingModules(org.modules || ['deca', 'flota']);
  };

  const toggleModule = (m: string) => {
    setEditingModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const saveModules = async (orgId: string) => {
    setModulesSaving(true);
    try {
      const res = await fetch('/api/admin/update-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSecret, orgId, modules: editingModules }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || 'Error al guardar los módulos.');
      } else {
        setEditingModulesOrgId(null);
        await fetchOrgs(adminSecret);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setModulesSaving(false);
    }
  };

  // ─── Asociar (dar de alta) un transportista a una organización ───
  const handleAddCarrierToOrg = async (e: React.FormEvent, orgId: string) => {
    e.preventDefault();
    setCarrierSaving(true);
    setCarrierResult(null);

    try {
      const res = await fetch('/api/admin/add-carrier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminSecret,
          orgId,
          companyName: carrierForm.company_name,
          cif: carrierForm.cif,
          address: carrierForm.address,
          phone: carrierForm.phone,
          email: carrierForm.email,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setCarrierResult({ ok: false, msg: data.error });
      } else {
        setCarrierResult({ ok: true, msg: data.message });
        setCarrierForm({ company_name: '', cif: '', address: '', phone: '', email: '' });
        setOrgDetails(prev => {
          const current = prev[orgId] || { members: [], carriers: [] };
          const updated = [...current.carriers, data.carrier].sort((a, b) => a.company_name.localeCompare(b.company_name));
          return { ...prev, [orgId]: { ...current, carriers: updated } };
        });
      }
    } catch (err: any) {
      setCarrierResult({ ok: false, msg: err.message });
    } finally {
      setCarrierSaving(false);
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

        {/* Contraseña de admin (compartida) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña de administrador</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={adminSecret}
              onChange={e => setAdminSecret(e.target.value)}
              onBlur={handleSecretBlur}
              className="flex-1 px-3 py-2 border rounded-lg text-sm text-slate-900"
              placeholder="La que tienes en ADMIN_SECRET en Vercel"
            />
            <button
              type="button"
              onClick={() => fetchOrgs(adminSecret)}
              disabled={!adminSecret || orgsLoading}
              title="Recargar organizaciones"
              className="px-3 py-2 border rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${orgsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Al salir del campo se cargan las organizaciones automáticamente.
          </p>
        </div>

        {/* ── Sección 1: Nuevo cliente ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            Dar de alta un nuevo cliente
          </h2>
          <p className="text-xs text-slate-500">
            Crea la organización y el primer usuario en un solo paso. El usuario podrá iniciar sesión inmediatamente.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-4">
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

            <button type="submit" disabled={loading || !adminSecret}
              className="w-full bg-[#2A1670] hover:bg-[#1e1050] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
              <UserPlus className="w-4 h-4" />
              {loading ? 'Creando...' : 'Crear empresa y usuario'}
            </button>
          </form>
        </div>

        {/* ── Sección 2: Añadir usuario a org existente ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Añadir usuario a empresa existente
          </h2>
          <p className="text-xs text-slate-500">
            Crea un segundo (o tercer…) empleado y asígnalo a una empresa que ya existe.
          </p>

          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Empresa</label>
              {orgs.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Introduce la contraseña de administrador arriba para cargar las empresas.
                </p>
              ) : (
                <select
                  required
                  value={addUserOrgId}
                  onChange={e => setAddUserOrgId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 bg-white"
                >
                  <option value="">— Selecciona una empresa —</option>
                  {orgs.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email del nuevo usuario</label>
              <input
                required type="email" value={addUserEmail}
                onChange={e => setAddUserEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                placeholder="empleado2@empresa.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña inicial</label>
              <div className="relative">
                <input
                  required type={showAddUserPassword ? 'text' : 'password'} value={addUserPassword}
                  onChange={e => setAddUserPassword(e.target.value)}
                  minLength={8}
                  className="w-full px-3 py-2 pr-10 border rounded-lg text-sm text-slate-900"
                  placeholder="Mínimo 8 caracteres"
                />
                <button type="button" onClick={() => setShowAddUserPassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                  {showAddUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {addUserResult && (
              <div className={`flex items-start gap-2 p-3 rounded-xl text-sm border ${addUserResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                {addUserResult.ok
                  ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                }
                {addUserResult.msg}
              </div>
            )}

            <button type="submit" disabled={addUserLoading || !adminSecret || !addUserOrgId}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
              <Users className="w-4 h-4" />
              {addUserLoading ? 'Añadiendo...' : 'Añadir usuario'}
            </button>
          </form>
        </div>

        {/* ── Lista de organizaciones activas ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-sm">
              Organizaciones activas {orgs.length > 0 && `(${orgs.length})`}
            </h2>
            <button
              onClick={() => fetchOrgs(adminSecret)}
              disabled={!adminSecret || orgsLoading}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${orgsLoading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </div>

          {orgs.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              {adminSecret
                ? orgsLoading ? 'Cargando...' : 'No hay organizaciones todavía.'
                : 'Introduce la contraseña de administrador para ver las organizaciones.'
              }
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3 text-left">Empresa</th>
                  <th className="p-3 text-left">Slug</th>
                  <th className="p-3 text-left">Módulos</th>
                  <th className="p-3 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orgs.map(org => {
                  const isExpanded = expandedOrgId === org.id;
                  const details = orgDetails[org.id];
                  const isEditingModules = editingModulesOrgId === org.id;

                  return (
                    <Fragment key={org.id}>
                      <tr
                        onClick={() => toggleExpandOrg(org.id)}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <td className="p-3 font-semibold text-slate-800">{org.name}</td>
                        <td className="p-3 font-mono text-slate-500 text-xs">{org.slug}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {(org.modules || []).map((m: string) => (
                              <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-semibold">{m}</span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${org.id}-detail`}>
                          <td colSpan={4} className="p-0 bg-slate-50 border-t border-slate-200">
                            {orgDetailsLoading === org.id ? (
                              <div className="p-6 text-center text-slate-400 text-sm">Cargando detalle...</div>
                            ) : (
                              <div className="p-5 space-y-6">

                                {/* Usuarios asociados */}
                                <div>
                                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                    <Users className="w-3.5 h-3.5" /> Usuarios asociados {details && `(${details.members.length})`}
                                  </h3>
                                  {!details || details.members.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">Sin usuarios todavía.</p>
                                  ) : (
                                    <ul className="space-y-1">
                                      {details.members.map((m: any) => (
                                        <li key={m.user_id} className="text-sm text-slate-700 flex items-center gap-2">
                                          <span className="font-medium">{m.email}</span>
                                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] rounded-full uppercase font-bold">{m.role}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>

                                {/* Módulos contratados */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                                      <Settings2 className="w-3.5 h-3.5" /> Módulos contratados
                                    </h3>
                                    {!isEditingModules && (
                                      <button
                                        type="button"
                                        onClick={() => startEditModules(org)}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                                      >
                                        Editar
                                      </button>
                                    )}
                                  </div>

                                  {isEditingModules ? (
                                    <div className="space-y-2">
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
                                          <input
                                            type="checkbox"
                                            checked={editingModules.includes('carga')}
                                            onChange={() => toggleModule('carga')}
                                            className="rounded"
                                          />
                                          Órdenes de Carga <span className="text-slate-400 text-xs">(opcional)</span>
                                        </label>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          disabled={modulesSaving}
                                          onClick={() => saveModules(org.id)}
                                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                                        >
                                          {modulesSaving ? 'Guardando...' : 'Guardar módulos'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingModulesOrgId(null)}
                                          className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {(org.modules || []).map((m: string) => (
                                        <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-semibold">{m}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Transportistas asociados */}
                                <div>
                                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                    <Truck className="w-3.5 h-3.5" /> Transportistas {details && `(${details.carriers.length})`}
                                  </h3>

                                  {details && details.carriers.length > 0 && (
                                    <ul className="space-y-1 mb-3">
                                      {details.carriers.map((c: any) => (
                                        <li key={c.id} className="text-sm text-slate-700">
                                          <span className="font-medium">{c.company_name}</span>
                                          <span className="text-slate-400 text-xs ml-2">{c.cif}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}

                                  <form onSubmit={(e) => handleAddCarrierToOrg(e, org.id)} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Asociar nuevo transportista</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <input required placeholder="Empresa Transportista" value={carrierForm.company_name} onChange={e => setCarrierForm({ ...carrierForm, company_name: e.target.value })} className="px-3 py-1.5 border rounded-lg text-sm text-slate-900" />
                                      <input required placeholder="CIF" value={carrierForm.cif} onChange={e => setCarrierForm({ ...carrierForm, cif: e.target.value })} className="px-3 py-1.5 border rounded-lg text-sm text-slate-900" />
                                      <input placeholder="Domicilio" value={carrierForm.address} onChange={e => setCarrierForm({ ...carrierForm, address: e.target.value })} className="px-3 py-1.5 border rounded-lg text-sm text-slate-900 sm:col-span-2" />
                                      <input placeholder="Teléfono" value={carrierForm.phone} onChange={e => setCarrierForm({ ...carrierForm, phone: e.target.value })} className="px-3 py-1.5 border rounded-lg text-sm text-slate-900" />
                                      <input type="email" placeholder="Email" value={carrierForm.email} onChange={e => setCarrierForm({ ...carrierForm, email: e.target.value })} className="px-3 py-1.5 border rounded-lg text-sm text-slate-900" />
                                    </div>

                                    {carrierResult && (
                                      <div className={`flex items-start gap-2 p-2 rounded-lg text-xs border ${carrierResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                                        {carrierResult.ok
                                          ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                          : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        }
                                        {carrierResult.msg}
                                      </div>
                                    )}

                                    <button type="submit" disabled={carrierSaving} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                                      <Plus className="w-3.5 h-3.5" /> {carrierSaving ? 'Añadiendo...' : 'Añadir transportista'}
                                    </button>
                                  </form>
                                </div>

                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
