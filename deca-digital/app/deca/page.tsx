"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { LogOut, FileText, PlusCircle, Download, FileEdit, Eye, Home } from 'lucide-react';
import { generateDecaPdf } from '../utils/pdfGenerator';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [decas, setDecas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const router = useRouter();
  
  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      const { data: decasData, error } = await supabase
        .from('decas')
        .select('*')
        .order('creation_date', { ascending: false });

      if (!error && decasData) {
        setDecas(decasData);
      }
      
      setLoading(false);
    };

    loadData();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Función para descargar el PDF de un documento existente (Obligación legal BOE)
  const handleDownloadPdf = async (doc: any) => {
    try {
      setDownloadingId(doc.id);

      // Documento real ya almacenado en el repositorio: lo descargamos tal cual,
      // sin regenerarlo, para que sea exactamente el mismo fichero que vería un inspector.
      if (doc.pdf_storage_path) {
        const { data: publicUrlData } = supabase.storage
          .from('decas-pdf')
          .getPublicUrl(doc.pdf_storage_path);

        // Traemos el PDF como datos (fetch) en vez de enlazar directo a la URL de
        // Storage: al ser de otro dominio, el navegador ignora el atributo
        // "download" en enlaces cross-origin y simplemente abre el archivo en vez
        // de descargarlo. Un blob: sí es del mismo origen que la página, así que
        // fuerza la descarga real.
        const response = await fetch(`${publicUrlData.publicUrl}?v=${doc.version}`);
        const fileBlob = await response.blob();
        const blobUrl = URL.createObjectURL(fileBlob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${doc.id}_v${doc.version}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        return;
      }

      // Reserva de compatibilidad: documentos antiguos sin fichero almacenado.
      const verificationUrl = doc.qr_url || `https://deca-ochre.vercel.app/verificar/${doc.id}`;
      
      const decaData = {
        id: doc.id,
        version: doc.version,
        creationDate: doc.creation_date,
        status: doc.status,
        carrier: doc.carrier,
        contractualShipper: doc.contractual_shipper,
        shipments: doc.shipments,
        route: doc.route,
        history: doc.history || [],
        digitalSignature: doc.digital_signature,
        fileSizeBytes: doc.file_size_bytes || 0,
        legalRetentionExpiresDate: doc.legal_retention_expires_date || '',
        qrUrl: verificationUrl,
        observations: doc.observations || '',
        stops: doc.stops || []
      };

      const { blob } = await generateDecaPdf(decaData, verificationUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.id}_v${doc.version}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al descargar el PDF:", err);
      alert("Hubo un error al generar el PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreviewPdf = async (doc: any) => {
    try {
      setPreviewingId(doc.id);

      // Documento real ya almacenado: lo abrimos directamente en una pestaña nueva,
      // el navegador lo muestra con su visor de PDF nativo, sin forzar descarga.
      if (doc.pdf_storage_path) {
        const { data: publicUrlData } = supabase.storage
          .from('decas-pdf')
          .getPublicUrl(doc.pdf_storage_path);
        window.open(`${publicUrlData.publicUrl}?v=${doc.version}`, '_blank');
        return;
      }

      // Reserva de compatibilidad: documentos antiguos sin fichero almacenado.
      const verificationUrl = doc.qr_url || `https://deca-ochre.vercel.app/verificar/${doc.id}`;
      const decaData = {
        id: doc.id,
        version: doc.version,
        creationDate: doc.creation_date,
        status: doc.status,
        carrier: doc.carrier,
        contractualShipper: doc.contractual_shipper,
        shipments: doc.shipments,
        route: doc.route,
        history: doc.history || [],
        digitalSignature: doc.digital_signature,
        fileSizeBytes: doc.file_size_bytes || 0,
        legalRetentionExpiresDate: doc.legal_retention_expires_date || '',
        qrUrl: verificationUrl,
        observations: doc.observations || '',
        stops: doc.stops || []
      };
      const { blob } = await generateDecaPdf(decaData, verificationUrl);
      const previewWindow = window.open(URL.createObjectURL(blob), '_blank');
      if (!previewWindow) {
        alert('El navegador ha bloqueado la ventana emergente. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.');
      }
    } catch (err) {
      console.error("Error al previsualizar el PDF:", err);
      alert("Hubo un error al generar la vista previa.");
    } finally {
      setPreviewingId(null);
    }
  };

  const handleStatusChange = async (docId: string, newStatus: string) => {
    // Cambio de estado puramente interno: no genera nueva versión, no regenera
    // el PDF ni notifica al conductor — es solo para tu gestión en el panel.
    setDecas(prev => prev.map(d => d.id === docId ? { ...d, status: newStatus } : d));
    const { error } = await supabase.from('decas').update({ status: newStatus }).eq('id', docId);
    if (error) {
      console.error(error);
      alert('No se pudo actualizar el estado.');
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
  const filteredDecas = decas.filter(doc => {
    if (q) {
      const matches = doc.id?.toLowerCase().includes(q)
        || doc.carrier?.companyName?.toLowerCase().includes(q)
        || doc.carrier?.tractorPlate?.toLowerCase().includes(q)
        || doc.internal_title?.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (statusFilter && doc.status !== statusFilter) return false;
    const transportDate = doc.route?.plannedStartDate ? doc.route.plannedStartDate.slice(0, 10) : '';
    if (dateFrom && transportDate < dateFrom) return false;
    if (dateTo && transportDate > dateTo) return false;
    return true;
  });

  const role = user.user_metadata?.role || 'user';
  const isAdmin = role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <button onClick={() => router.push('/')} className="flex items-center gap-2" title="Ir al menú principal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-operpal-icon.png" alt="OPERPAL" className="w-9 h-9 object-contain" />
          <h1 className="text-lg font-bold text-slate-800">DeCA Digital</h1>
        </button>
        
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Menú principal">
            <Home className="w-5 h-5" />
          </button>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-slate-800">{user.user_metadata?.full_name || 'Usuario'}</span>
            <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
              {isAdmin ? 'Administrador' : 'Transportista'}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 sm:p-10 max-w-7xl mx-auto w-full flex flex-col gap-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Documentos Activos</h2>
            <p className="text-sm text-slate-500">Panel de gestión y control en tiempo real</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={() => router.push('/emitir')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              Emitir Nuevo DeCA
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row flex-wrap gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por ID, transportista, matrícula o título..."
            className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg text-sm text-slate-900"
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
            <option value="">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="EN_TRANSITO">En Tránsito</option>
            <option value="ENTREGADO">Entregado</option>
            <option value="MODIFICADO_EN_RUTA">Modificado en Ruta</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
            <span className="text-slate-400 text-sm">a</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
          </div>
          {(searchQuery || statusFilter || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {filteredDecas.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm text-center">
            <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">{decas.length === 0 ? 'No hay documentos registrados' : 'Sin resultados para esos filtros'}</h3>
            <p className="text-slate-500 max-w-md mx-auto text-sm">
              {decas.length === 0
                ? 'Aún no has emitido ningún Documento de Control. Haz clic en "Emitir Nuevo DeCA" para crear el primero.'
                : 'Prueba a cambiar la búsqueda, el estado o el rango de fechas.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                  <tr>
                    <th className="p-4">ID DeCA</th>
                    <th className="p-4">Transportista</th>
                    <th className="p-4">Ruta</th>
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Versión</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredDecas.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono font-bold text-blue-900">
                        {doc.id}
                        {doc.internal_title && (
                          <div className="font-sans font-normal text-xs text-slate-400 mt-0.5">{doc.internal_title}</div>
                        )}
                      </td>
                      <td className="p-4">{doc.carrier?.companyName || 'Sin asignar'}</td>
                      <td className="p-4">{doc.route?.originMain} → {doc.route?.destinationMain}</td>
                      <td className="p-4 whitespace-nowrap">
                        {doc.route?.plannedStartDate ? new Date(doc.route.plannedStartDate).toLocaleDateString('es-ES') : '—'}
                      </td>
                      <td className="p-4">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded text-xs font-bold border border-slate-200">
                          v{doc.version}.0
                        </span>
                      </td>
                      <td className="p-4">
                        <select
                          value={doc.status}
                          onChange={e => handleStatusChange(doc.id, e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg text-xs font-semibold px-2 py-1.5 text-slate-700"
                        >
                          <option value="BORRADOR">Borrador</option>
                          <option value="EN_TRANSITO">En Tránsito</option>
                          <option value="ENTREGADO">Entregado</option>
                          <option value="MODIFICADO_EN_RUTA">Modificado en Ruta</option>
                          <option value="CANCELADO">Cancelado</option>
                        </select>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => router.push(`/modificar/${doc.id}`)}
                            title="Editar"
                            className="group flex items-center gap-1.5 h-8 w-8 hover:w-24 overflow-hidden px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition-all duration-300"
                          >
                            <FileEdit className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">Editar</span>
                          </button>

                          <button
                            onClick={() => handlePreviewPdf(doc)}
                            disabled={previewingId === doc.id}
                            title="Previsualizar"
                            className="group flex items-center gap-1.5 h-8 w-8 hover:w-32 disabled:hover:w-8 overflow-hidden px-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg shadow-sm transition-all duration-300 disabled:opacity-50"
                          >
                            <Eye className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">{previewingId === doc.id ? 'Abriendo...' : 'Ver'}</span>
                          </button>

                          <button
                            onClick={() => handleDownloadPdf(doc)}
                            disabled={downloadingId === doc.id}
                            title="Descargar"
                            className="group flex items-center gap-1.5 h-8 w-8 hover:w-32 disabled:hover:w-8 overflow-hidden px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all duration-300 disabled:opacity-50"
                          >
                            <Download className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">{downloadingId === doc.id ? 'Generando...' : 'Descargar'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}