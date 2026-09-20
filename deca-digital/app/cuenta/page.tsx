"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { ArrowLeft, UserCircle, Save, KeyRound, Mail, AlertTriangle, Building2, ImagePlus, X } from 'lucide-react';

export default function MiCuenta() {
  const router = useRouter();
  const supabase = createClient();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // --- Nombre ---
  const [fullName, setFullName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // --- Email ---
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // --- Contraseña ---
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // --- Perfil de empresa ---
  const [companyName, setCompanyName] = useState('');
  const [cif, setCif] = useState('');
  const [address, setAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2A1670');
  const [accentColor, setAccentColor] = useState('#E98837');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      setFullName(session.user.user_metadata?.full_name || '');
      setNewEmail(session.user.email || '');

      // Cargar perfil de empresa del usuario actual
      const { data: profile } = await supabase
        .from('company_profile')
        .select('company_name, cif, address, phone, email, logo_url, primary_color, accent_color')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profile) {
        setCompanyName(profile.company_name || '');
        setCif(profile.cif || '');
        setAddress(profile.address || '');
        setCompanyPhone(profile.phone || '');
        setCompanyEmail(profile.email || '');
        setPrimaryColor(profile.primary_color || '#2A1670');
        setAccentColor(profile.accent_color || '#E98837');
        setLogoUrl(profile.logo_url || null);
        setLogoPreview(profile.logo_url || null);
      }

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

  // Subir logo al bucket company-logos y guardar la URL pública
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validar tipo y tamaño (máx 2 MB)
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setCompanyError('Solo se admiten imágenes PNG, JPG o WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setCompanyError('El logo no puede superar 2 MB.');
      return;
    }

    setCompanyError(null);
    setLogoUploading(true);

    // Vista previa inmediata
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Determinar extensión
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpeg';
    const filePath = `${user.id}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setCompanyError(`Error al subir el logo: ${uploadError.message}`);
      setLogoUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('company-logos')
      .getPublicUrl(filePath);

    // Añadir timestamp para evitar caché del navegador
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setLogoUrl(publicUrl);
    setLogoPreview(publicUrl);
    setLogoUploading(false);
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCompanySaving(true);
    setCompanyError(null);
    setCompanySaved(false);

    // Obtener el org_id del usuario
    const { data: membership } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Si hay logo, intentamos obtener sus dimensiones desde el elemento img de la preview
    // Las guardamos como null si no están disponibles (se pueden inferir después)
    let logoWidthPx: number | null = null;
    let logoHeightPx: number | null = null;

    if (logoUrl && logoPreview) {
      try {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            logoWidthPx = img.naturalWidth;
            logoHeightPx = img.naturalHeight;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = logoPreview;
        });
      } catch { /* si falla, dejamos null */ }
    }

    const { error } = await supabase
      .from('company_profile')
      .upsert({
        user_id: user.id,
        org_id: membership?.org_id ?? null,
        company_name: companyName || null,
        cif: cif || null,
        address: address || null,
        phone: companyPhone || null,
        email: companyEmail || null,
        logo_url: logoUrl || null,
        logo_width_px: logoWidthPx,
        logo_height_px: logoHeightPx,
        primary_color: primaryColor,
        accent_color: accentColor,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    setCompanySaving(false);
    if (error) {
      setCompanyError(`Error al guardar: ${error.message}`);
    } else {
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 3000);
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
        <form onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 mb-6">
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

        {/* PERFIL DE EMPRESA */}
        <form onSubmit={handleSaveCompany} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div>
            <h3 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> Perfil de Empresa
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              Estos datos aparecen en la cabecera de los PDFs generados (DeCA, órdenes de carga) en lugar del logo de OPERPAL.
            </p>
          </div>

          {/* Logo */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Logo de la empresa</label>
            <div className="flex items-start gap-4">
              {/* Preview */}
              <div className="flex-shrink-0 w-28 h-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden relative">
                {logoPreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain p-1" />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute top-1 right-1 bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-rose-600"
                      title="Eliminar logo"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </>
                ) : (
                  <ImagePlus className="w-7 h-7 text-slate-300" />
                )}
              </div>

              <div className="flex-1">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleLogoChange}
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition
                    ${logoUploading ? 'opacity-50 cursor-not-allowed' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`}
                >
                  <ImagePlus className="w-4 h-4" />
                  {logoUploading ? 'Subiendo...' : logoPreview ? 'Cambiar logo' : 'Subir logo'}
                </label>
                <p className="text-xs text-slate-400 mt-1.5">PNG, JPG o WebP · Máx. 2 MB · Fondo blanco o transparente recomendado</p>
              </div>
            </div>
          </div>

          {/* Campos de empresa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre de la empresa <span className="text-rose-400">*</span></label>
              <input
                type="text"
                required
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Ej. Transportes García, S.L."
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">CIF / NIF</label>
              <input
                type="text"
                value={cif}
                onChange={e => setCif(e.target.value)}
                placeholder="Ej. B12345678"
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
              <input
                type="text"
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                placeholder="Ej. 957 00 00 00"
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Dirección</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Ej. Calle Mayor 1, 14700 Palma del Río, Córdoba"
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email de contacto</label>
              <input
                type="email"
                value={companyEmail}
                onChange={e => setCompanyEmail(e.target.value)}
                placeholder="Ej. info@transportes.com"
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
              />
            </div>
          </div>

          {/* Colores corporativos */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Colores corporativos en el PDF</label>
            <p className="text-xs text-slate-400 mb-3">
              Se usan en las cabeceras de sección, la franja divisoria y el texto de fecha del DeCA.
              Si los dejas en blanco se usarán los colores de OPERPAL por defecto.
            </p>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    title="Color principal"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Color principal</p>
                  <p className="text-xs text-slate-400">Cabeceras, títulos, pie de página</p>
                  <code className="text-xs text-slate-500">{primaryColor}</code>
                </div>
                {primaryColor !== '#2A1670' && (
                  <button type="button" onClick={() => setPrimaryColor('#2A1670')} className="text-xs text-slate-400 hover:text-slate-600 underline">Reset</button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    title="Color de acento"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Color de acento</p>
                  <p className="text-xs text-slate-400">Franja divisoria, fecha, paradas</p>
                  <code className="text-xs text-slate-500">{accentColor}</code>
                </div>
                {accentColor !== '#E98837' && (
                  <button type="button" onClick={() => setAccentColor('#E98837')} className="text-xs text-slate-400 hover:text-slate-600 underline">Reset</button>
                )}
              </div>
            </div>
            {/* Preview mini de los colores */}
            <div className="mt-3 rounded-lg overflow-hidden border border-slate-100 flex h-6">
              <div className="flex-1" style={{ backgroundColor: primaryColor }} />
              <div className="flex-1" style={{ backgroundColor: accentColor }} />
            </div>
          </div>

          {companyError && (
            <p className="text-sm font-semibold text-rose-600">✗ {companyError}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={companySaving || logoUploading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {companySaving ? 'Guardando...' : 'Guardar Perfil de Empresa'}
            </button>
            {companySaved && <span className="text-sm text-emerald-600 font-semibold">✓ Guardado</span>}
          </div>
        </form>

      </div>
    </div>
  );
}
