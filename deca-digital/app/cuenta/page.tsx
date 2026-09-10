"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { ArrowLeft, UserCircle, Save, KeyRound, Mail, AlertTriangle } from 'lucide-react';

export default function MiCuenta() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [fullName, setFullName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      setFullName(session.user.user_metadata?.full_name || '');
      setNewEmail(session.user.email || '');
      setLoading(false);
    };
    init();
  }, []);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameSaving(true);
    setNameSaved(false);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    setNameSaving(false);
    if (!error) {
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 3000);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSaving(true);
    setEmailResult(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailSaving(false);
    if (error) {
      setEmailResult({ ok: false, msg: error.message });
    } else {
      setEmailResult({ ok: true, msg: 'Te hemos enviado un correo de confirmación a la nueva dirección. El cambio no se aplica hasta que lo confirmes desde ese enlace.' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordResult(null);
    if (newPassword.length < 6) {
      setPasswordResult({ ok: false, msg: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordResult({ ok: false, msg: 'Las dos contraseñas no coinciden.' });
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordResult({ ok: false, msg: error.message });
    } else {
      setPasswordResult({ ok: true, msg: 'Contraseña actualizada correctamente.' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2A1670]"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="max-w-2xl mx-auto w-full">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Volver al Menú Principal
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCircle className="w-6 h-6 text-blue-600" />
            Mi Cuenta
          </h2>
          <p className="text-sm text-slate-500 mt-1">Sesión conectada como {user.email}</p>
        </div>

        {/* NOMBRE */}
        <form onSubmit={handleSaveName} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 mb-6">
          <h3 className="font-bold text-slate-800 border-b pb-2">Nombre visible</h3>
          <p className="text-xs text-slate-500">Es el nombre que aparece en la cabecera del panel del DeCA.</p>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Tu nombre" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={nameSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
              <Save className="w-4 h-4" /> {nameSaving ? 'Guardando...' : 'Guardar Nombre'}
            </button>
            {nameSaved && <span className="text-sm text-emerald-600 font-semibold">✓ Guardado</span>}
          </div>
        </form>

        {/* EMAIL */}
        <form onSubmit={handleChangeEmail} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 mb-6">
          <h3 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><Mail className="w-4 h-4" /> Email de inicio de sesión</h3>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Si cambias este email, avisa para actualizar también la variable <code className="bg-amber-100 px-1 rounded">SMTP{"{N}"}_LOGIN_EMAIL</code> en Vercel — si no, dejarás de poder notificar por email hasta que se actualice.</p>
          </div>
          <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={emailSaving || newEmail === user.email} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
              <Save className="w-4 h-4" /> {emailSaving ? 'Enviando...' : 'Cambiar Email'}
            </button>
          </div>
          {emailResult && (
            <p className={`text-sm font-semibold ${emailResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
              {emailResult.ok ? '✓' : '✗'} {emailResult.msg}
            </p>
          )}
        </form>

        {/* CONTRASEÑA */}
        <form onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Cambiar Contraseña</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nueva Contraseña</label>
              <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Confirmar Contraseña</label>
              <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={passwordSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
              <Save className="w-4 h-4" /> {passwordSaving ? 'Guardando...' : 'Cambiar Contraseña'}
            </button>
          </div>
          {passwordResult && (
            <p className={`text-sm font-semibold ${passwordResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
              {passwordResult.ok ? '✓' : '✗'} {passwordResult.msg}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
