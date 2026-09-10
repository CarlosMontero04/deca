"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { LogOut, FileText, PlusCircle, Download, Truck, Eye, FileEdit } from 'lucide-react';

export default function PanelOrdenesCarga() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-operpal-icon.png" alt="OPERPAL" className="w-9 h-9 object-contain" />
          <h1 className="text-lg font-bold text-slate-800">Órdenes de Carga</h1>
        </div>
        <div className="flex items-center gap-4">
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
              onClick={() => router.push('/')}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              <Truck className="w-5 h-5" />
              DeCA Digital
            </button>
            <button
              onClick={() => router.push('/carga/nueva')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              Nueva Orden de Carga
            </button>
          </div>
        </div>

        {ordenes.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm text-center">
            <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No hay órdenes de carga registradas</h3>
            <p className="text-slate-500 max-w-md mx-auto text-sm">
              Haz clic en "Nueva Orden de Carga" para crear la primera.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                <tr>
                  <th className="p-4">Nº Orden</th>
                  <th className="p-4">Transportista</th>
                  <th className="p-4">Ruta</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Precio</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordenes.map((orden) => (
                  <tr key={orden.id} className="hover:bg-slate-50">
                    <td className="p-4 font-mono font-bold text-blue-900">{orden.id}</td>
                    <td className="p-4">{orden.carrier_name}</td>
                    <td className="p-4">{orden.origen || '—'} → {orden.destino || '—'}</td>
                    <td className="p-4 whitespace-nowrap">{orden.fecha ? new Date(orden.fecha).toLocaleDateString('es-ES') : '—'}</td>
                    <td className="p-4">{orden.precio_concertado || '—'}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button
                          onClick={() => router.push(`/carga/modificar/${orden.id}`)}
                          className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors"
                        >
                          <FileEdit className="w-4 h-4 text-white" />
                          Editar
                        </button>
                        <button
                          onClick={() => handlePreview(orden)}
                          disabled={previewingId === orden.id}
                          className="inline-flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                        >
                          <Eye className="w-4 h-4 text-white" />
                          {previewingId === orden.id ? 'Abriendo...' : 'Previsualizar'}
                        </button>
                        <button
                          onClick={() => handleDownload(orden)}
                          disabled={downloadingId === orden.id}
                          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                        >
                          <Download className="w-4 h-4 text-white" />
                          {downloadingId === orden.id ? 'Descargando...' : 'Descargar'}
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
