"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from './utils/supabase/client';
import { LogOut, Truck, FileText, PlusCircle, Download, FileEdit } from 'lucide-react';
import { generateDecaPdf } from './utils/pdfGenerator';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [decas, setDecas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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

        // Añadimos ?v=version para que cada versión sea, a efectos de caché del
        // navegador/CDN, una URL distinta — si no, tras modificar podrías seguir
        // viendo la versión antigua durante un rato aunque el archivo ya cambió.
        const a = document.createElement('a');
        a.href = `${publicUrlData.publicUrl}?v=${doc.version}`;
        a.download = `${doc.id}_v${doc.version}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return null;

  const role = user.user_metadata?.role || 'user';
  const isAdmin = role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white">
            <Truck className="w-4 h-4" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">DeCA Digital</h1>
        </div>
        
        <div className="flex items-center gap-4">
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
          <button 
            onClick={() => router.push('/emitir')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
          >
            <PlusCircle className="w-5 h-5" />
            Emitir Nuevo DeCA
          </button>
        </div>

        {decas.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm text-center">
            <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No hay documentos registrados</h3>
            <p className="text-slate-500 max-w-md mx-auto text-sm">
              Aún no has emitido ningún Documento de Control. Haz clic en "Emitir Nuevo DeCA" para crear el primero.
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
                    <th className="p-4">Versión</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {decas.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono font-bold text-blue-900">
                        {doc.id}
                        {doc.internal_title && (
                          <div className="font-sans font-normal text-xs text-slate-400 mt-0.5">{doc.internal_title}</div>
                        )}
                      </td>
                      <td className="p-4">{doc.carrier?.companyName || 'Sin asignar'}</td>
                      <td className="p-4">{doc.route?.originMain} → {doc.route?.destinationMain}</td>
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
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => router.push(`/modificar/${doc.id}`)}
                            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors"
                          >
                            <FileEdit className="w-4 h-4 text-white" />
                            Editar
                          </button>
                          
                          <button
                            onClick={() => handleDownloadPdf(doc)}
                            disabled={downloadingId === doc.id}
                            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                          >
                            <Download className="w-4 h-4 text-white" />
                            {downloadingId === doc.id ? 'Generando...' : 'Descargar'}
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