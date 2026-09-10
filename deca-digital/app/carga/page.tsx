"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { LogOut, FileText, PlusCircle, Download, Eye, FileEdit, MessageCircle, Mail, Home } from 'lucide-react';
import { notifyCarrierOrden } from '../utils/notifyCarrierOrden';

export default function PanelOrdenesCarga() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleQuickNotify = async (orden: any, method: 'telefono' | 'email') => {
    setNotifyingId(orden.id);
    const mensaje = method === 'email'
      ? `Aquí tienes la Orden de Carga ${orden.id} adjunta en PDF.`
      : `Aquí tienes la Orden de Carga ${orden.id}.`;
    const r = await notifyCarrierOrden(supabase, method, orden.carrier_phone, orden.carrier_email, orden.id, orden.pdf_storage_path, mensaje);
    setNotifyingId(null);
    if (!r.success) alert(r.error);
  };

  const handlePreview = async (orden: any) => {
    try {
      setPreviewingId(orden.id);
      const { data, error } = await supabase.storage.from('ordenes-carga-pdf').download(orden.pdf_storage_path);
      if (error || !data) throw error;
      const url = URL.createObjectURL(data);
      const win = window.open(url, '_blank');
      if (!win) {
        alert('El navegador ha bloqueado la ventana emergente. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.');
      }
    } catch (err) {
      console.error(err);
      alert('No se pudo abrir la vista previa.');
    } finally {
      setPreviewingId(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      const { data } = await supabase
        .from('ordenes_carga')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      setOrdenes(data || []);
      setLoading(false);
    };
    init();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDownload = async (orden: any) => {
    try {
      setDownloadingId(orden.id);
      const { data, error } = await supabase.storage.from('ordenes-carga-pdf').download(orden.pdf_storage_path);
      if (error || !data) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${orden.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('No se pudo descargar el PDF.');
    } finally {
      setDownloadingId(null);
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

  const q = searchQuery.trim().toLowerCase();
  const ordenesFiltradas = ordenes.filter(o => {
    if (q) {
      const matches = o.id?.toLowerCase().includes(q)
        || o.carrier_name?.toLowerCase().includes(q)
        || o.origen?.toLowerCase().includes(q)
        || o.destino?.toLowerCase().includes(q);
      if (!matches) return false;
    }
    const fecha = o.fecha ? String(o.fecha).slice(0, 10) : '';
    if (dateFrom && fecha < dateFrom) return false;
    if (dateTo && fecha > dateTo) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <button onClick={() => router.push('/')} className="flex items-center gap-2" title="Ir al menú principal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-operpal-icon.png" alt="OPERPAL" className="w-9 h-9 object-contain" />
          <h1 className="text-lg font-bold text-slate-800">Órdenes de Carga</h1>
        </button>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Menú principal">
            <Home className="w-5 h-5" />
          </button>
          <div className="h-8 w-px bg-slate-200"></div>
          <span className="text-sm text-slate-500 hidden sm:inline">{user.email}</span>
          <button onClick={handleLogout} className="text-slate-400 hover:text-rose-600" title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 p-6 sm:p-10 max-w-6xl w-full mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Órdenes de Carga</h2>
            <p className="text-sm text-slate-500">Encargos a transportistas subcontratados</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => router.push('/carga/nueva')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              Nueva Orden de Carga
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row flex-wrap gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por Nº orden, transportista, origen o destino..."
            className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg text-sm text-slate-900"
          />
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
            <span className="text-slate-400 text-sm">a</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
          </div>
          {(searchQuery || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearchQuery(''); setDateFrom(''); setDateTo(''); }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {ordenesFiltradas.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm text-center">
            <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">{ordenes.length === 0 ? 'No hay órdenes de carga registradas' : 'Sin resultados para esos filtros'}</h3>
            <p className="text-slate-500 max-w-md mx-auto text-sm">
              {ordenes.length === 0
                ? 'Haz clic en "Nueva Orden de Carga" para crear la primera.'
                : 'Prueba a cambiar la búsqueda o el rango de fechas.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                <tr>
                  <th className="p-4">Nº Orden</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Transportista</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordenesFiltradas.map((orden) => (
                  <tr key={orden.id} className="hover:bg-slate-50">
                    <td className="p-4 font-mono font-bold text-blue-900">{orden.id}</td>
                    <td className="p-4 whitespace-nowrap">{orden.fecha ? new Date(orden.fecha).toLocaleDateString('es-ES') : '—'}</td>
                    <td className="p-4">{orden.carrier_name}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleQuickNotify(orden, 'telefono')}
                          disabled={!orden.carrier_phone || notifyingId === orden.id}
                          title="Reenviar por WhatsApp"
                          className="group flex items-center gap-1.5 h-8 w-8 hover:w-32 disabled:hover:w-8 overflow-hidden px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all duration-300 disabled:opacity-40"
                        >
                          <MessageCircle className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">WhatsApp</span>
                        </button>
                        <button
                          onClick={() => handleQuickNotify(orden, 'email')}
                          disabled={!orden.carrier_email || notifyingId === orden.id}
                          title="Reenviar por Email"
                          className="group flex items-center gap-1.5 h-8 w-8 hover:w-24 disabled:hover:w-8 overflow-hidden px-2 bg-blue-800 hover:bg-blue-900 text-white rounded-lg shadow-sm transition-all duration-300 disabled:opacity-40"
                        >
                          <Mail className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">Email</span>
                        </button>
                        <button
                          onClick={() => router.push(`/carga/modificar/${orden.id}`)}
                          title="Editar"
                          className="group flex items-center gap-1.5 h-8 w-8 hover:w-24 overflow-hidden px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition-all duration-300"
                        >
                          <FileEdit className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">Editar</span>
                        </button>
                        <button
                          onClick={() => handlePreview(orden)}
                          disabled={previewingId === orden.id}
                          title="Previsualizar"
                          className="group flex items-center gap-1.5 h-8 w-8 hover:w-32 disabled:hover:w-8 overflow-hidden px-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg shadow-sm transition-all duration-300 disabled:opacity-50"
                        >
                          <Eye className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">{previewingId === orden.id ? 'Abriendo...' : 'Ver'}</span>
                        </button>
                        <button
                          onClick={() => handleDownload(orden)}
                          disabled={downloadingId === orden.id}
                          title="Descargar"
                          className="group flex items-center gap-1.5 h-8 w-8 hover:w-32 disabled:hover:w-8 overflow-hidden px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all duration-300 disabled:opacity-50"
                        >
                          <Download className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">{downloadingId === orden.id ? 'Cargando...' : 'Descargar'}</span>
                        </button>
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
