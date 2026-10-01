"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { ArrowLeft, Users, UserPlus, ShieldCheck, Trash2, Eye, EyeOff } from 'lucide-react';

interface Member {
  user_id: string;
  email: string;
  role: 'admin' | 'member';
}

export default function MiEquipo() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addResult, setAddResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadMembers = async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await fetch('/api/team/members');
      const data = await res.json();
      if (!res.ok || data.error) {
        setMembersError(data.error || 'No se pudo cargar el equipo.');
      } else {
        setMembers(data.members ?? []);
      }
    } catch (err: any) {
      setMembersError(err.message);
    } finally {
      setMembersLoading(false);
    }
  };

  // Solo el admin de una organización puede entrar en esta pantalla.
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setCurrentUserId(session.user.id);

      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (membership?.role !== 'admin') {
        router.push('/');
        return;
      }

      setAllowed(true);
      setLoading(false);
      loadMembers();
    };
    init();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSaving(true);
    setAddResult(null);
    try {
      const res = await fetch('/api/team/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAddResult({ ok: false, msg: data.error });
      } else {
        setAddResult({ ok: true, msg: `Usuario ${newEmail} creado. Pásale tú la contraseña que has puesto.` });
        setNewEmail('');
        setNewPassword('');
        setMembers(prev => [...prev, data.member].sort((a, b) => a.email.localeCompare(b.email)));
      }
    } catch (err: any) {
      setAddResult({ ok: false, msg: err.message });
    } finally {
      setAddSaving(false);
    }
  };

  const handleToggleRole = async (member: Member) => {
    const nuevoRol = member.role === 'admin' ? 'member' : 'admin';
    setSavingUserId(member.user_id);
    try {
      const res = await fetch('/api/team/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.user_id, role: nuevoRol }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || 'Error al cambiar el rol.');
      } else {
        setMembers(prev => prev.map(m => m.user_id === member.user_id ? { ...m, role: nuevoRol } : m));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleRemove = async (member: Member) => {
    if (!confirm(`¿Quitar a ${member.email} de la organización? Dejará de poder entrar, pero sus DeCA y Órdenes de Carga ya creados se conservan.`)) return;
    setSavingUserId(member.user_id);
    try {
      const res = await fetch('/api/team/remove-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.user_id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || 'Error al quitar al usuario.');
      } else {
        setMembers(prev => prev.filter(m => m.user_id !== member.user_id));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingUserId(null);
    }
  };

  if (loading || !allowed) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2A1670]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="max-w-2xl mx-auto w-full">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Volver al Menú Principal
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" /> Mi Equipo
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Da de alta a los usuarios de tu empresa y decide quién más puede ver todos los DeCA y Órdenes de Carga como admin.
          </p>
        </div>

        {/* Lista de usuarios */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-6">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Usuarios de tu organización</h3>

          {membersLoading ? (
            <p className="text-sm text-slate-400">Cargando...</p>
          ) : membersError ? (
            <p className="text-sm text-rose-600">{membersError}</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin usuarios todavía.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {members.map((m) => {
                const esUnoMismo = m.user_id === currentUserId;
                const busy = savingUserId === m.user_id;
                return (
                  <li key={m.user_id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{m.email}</span>
                      {esUnoMismo && <span className="text-[10px] text-slate-400">(tú)</span>}
                      <span className={`px-1.5 py-0.5 text-[10px] rounded-full uppercase font-bold ${m.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                        {m.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleRole(m)}
                        disabled={busy}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-40 flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {m.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                      </button>
                      {!esUnoMismo && (
                        <button
                          type="button"
                          onClick={() => handleRemove(m)}
                          disabled={busy}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-40 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Quitar
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Dar de alta a un usuario nuevo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Dar de alta a un usuario nuevo
          </h3>

          {addResult && (
            <div className={`mb-4 p-3 rounded-lg text-sm border ${addResult.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
              {addResult.msg}
            </div>
          )}

          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
              <input
                type="email" required value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                placeholder="usuario@empresa.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña inicial</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} required minLength={6} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm text-slate-900"
                  placeholder="Mínimo 6 caracteres"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Tendrás que pasársela tú mismo al usuario por el canal que uses con él.</p>
            </div>
            <button type="submit" disabled={addSaving}
              className="w-full bg-[#2A1670] text-white font-bold py-2.5 rounded-lg hover:bg-[#1e1050] transition disabled:opacity-50">
              {addSaving ? 'Creando...' : 'Dar de alta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
