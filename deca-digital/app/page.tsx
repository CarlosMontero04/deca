"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from './utils/supabase/client';
import { LogOut, FileCheck, ClipboardList, Truck, ChevronRight } from 'lucide-react';

const MODULOS = [
  {
    href: '/deca',
    icon: FileCheck,
    titulo: 'DeCA Digital',
    descripcion: 'Emitir, modificar y consultar Documentos de Control Administrativo.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    href: '/carga',
    icon: ClipboardList,
    titulo: 'Órdenes de Carga',
    descripcion: 'Generar y enviar encargos a transportistas subcontratados.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    href: '/flota',
    icon: Truck,
    titulo: 'Gestionar Flota',
    descripcion: 'Transportistas, conductores, tractoras y remolques guardados.',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
];

export default function MenuPrincipal() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      setLoading(false);
    };
    init();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-operpal-icon.png" alt="OPERPAL" className="w-9 h-9 object-contain" />
          <h1 className="text-lg font-bold text-slate-800">OPERPAL</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 hidden sm:inline">{user.email}</span>
          <button onClick={handleLogout} className="text-slate-400 hover:text-rose-600" title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-operpal.png" alt="OPERPAL" className="h-14 w-auto mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-800">¿Qué quieres hacer?</h2>
            <p className="text-sm text-slate-500 mt-1">Elige un módulo para empezar</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {MODULOS.map((m) => (
              <button
                key={m.href}
                onClick={() => router.push(m.href)}
                className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 transition-all duration-200 p-6 text-left flex flex-col gap-4"
              >
                <div className={`w-12 h-12 rounded-xl ${m.bg} flex items-center justify-center`}>
                  <m.icon className={`w-6 h-6 ${m.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 flex items-center gap-1">
                    {m.titulo}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{m.descripcion}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
