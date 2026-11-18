"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { LogOut, FileText, PlusCircle, Download, FileEdit, Eye, Home, UserCircle, MessageCircle, Mail, Package } from 'lucide-react';
import BulkDownloadModal, { type BulkItem } from '../components/BulkDownloadModal';
import { generateDecaPdf } from '../utils/pdfGenerator';
import { loadOrgBranding } from '../utils/loadOrgBranding';
import { notifyDriver } from '../utils/notifyDriver';
import { useOrgLogo } from '../hooks/useOrgLogo';

export default function Dashboard() {
  const { logoUrl: orgLogoUrl, orgName } = useOrgLogo();
  const [user, setUser] = useState<any>(null);
  const [decas, setDecas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Rol real dentro de la organización (organization_members), no el de user_metadata
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [showBulkDownload, setShowBulkDownload] = useState(false);
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

      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .single();
      setIsOrgAdmin(membership?.role === 'admin');

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

  // Notificación rápida al conductor directamente desde el panel,
  // igual que los botones que ya existen en el panel de Órdenes de Carga.
  const handleQuickNotify = async (doc: any, method: 'telefono' | 'email') => {
    const phone = doc.carrier?.phone;
    const email = doc.carrier?.driverEmail;
    const verificationUrl = doc.qr_url || `https://deca-ochre.vercel.app/verificar/${doc.id}`;
    setNotifyingId(doc.id + method);
    const result = await notifyDriver(
      method, phone, email,
      `Aquí tienes tu Documento de Control (DeCA) ${doc.id}. Debes llevarlo contigo (PDF o QR) antes de iniciar el servicio.`,
      verificationUrl,
      orgName
    );
    setNotifyingId(null);
    if (!result.success) alert(result.error);
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

      const { blob } = await generateDecaPdf(decaData, verificationUrl, await loadOrgBranding(supabase));
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
      const { blob } = await generateDecaPdf(decaData, verificationUrl, await loadOrgBranding(supabase));
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

  type Doc = (typeof decas)[number];

  // --- Piezas compartidas por la tabla (pantallas anchas) y las tarjetas (pantallas estrechas) ---
  // Así ambas vistas muestran exactamente lo mismo y los botones se mantienen en un solo sitio.
  const renderStatusSelect = (doc: Doc) => (
    <select
      value={doc.status}
      onChange={e => handleStatusChange(doc.id, e.target.value)}
      aria-label={`Estado de ${doc.id}`}
      className="w-full max-w-[11rem] bg-white border border-slate-200 rounded-lg text-xs font-semibold px-2 py-1.5 text-slate-700"
    >
      <option value="BORRADOR">Borrador</option>
      <option value="EN_TRANSITO">En Tránsito</option>
      <option value="ENTREGADO">Entregado</option>
      <option value="MODIFICADO_EN_RUTA">Modificado en Ruta</option>
      <option value="CANCELADO">Cancelado</option>
    </select>
  );

  const renderPlates = (doc: Doc) => {
    const trailers = [doc.carrier?.trailerPlate, doc.carrier?.trailerPlate2].filter(Boolean);
    return (
      <>
        <div className="font-mono font-bold text-slate-800">{doc.carrier?.tractorPlate || '—'}</div>
        {trailers.map((plate: string) => (
          <div key={plate} className="font-mono text-xs text-slate-500 mt-0.5">{plate}</div>
        ))}
      </>
    );
  };

  const renderActions = (doc: Doc) => (
    <>
      <button
        onClick={() => handleQuickNotify(doc, 'telefono')}
        disabled={!doc.carrier?.phone || notifyingId === doc.id + 'telefono'}
        title="Notificar por WhatsApp"
        className="h-8 w-8 flex items-center justify-center shrink-0 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="sr-only">Notificar por WhatsApp</span>
      </button>

      <button
        onClick={() => handleQuickNotify(doc, 'email')}
        disabled={!doc.carrier?.driverEmail || notifyingId === doc.id + 'email'}
        title="Notificar por Email"
        className="h-8 w-8 flex items-center justify-center shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
      >
        <Mail className="w-4 h-4" />
        <span className="sr-only">Notificar por Email</span>
      </button>

      <button
        onClick={() => router.push(`/modificar/${doc.id}`)}
        title="Editar"
        className="h-8 w-8 flex items-center justify-center shrink-0 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition-colors"
      >
        <FileEdit className="w-4 h-4" />
        <span className="sr-only">Editar</span>
      </button>

      <button
        onClick={() => handlePreviewPdf(doc)}
        disabled={previewingId === doc.id}
        title="Previsualizar"
        className="h-8 w-8 flex items-center justify-center shrink-0 bg-slate-600 hover:bg-slate-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
      >
        <Eye className="w-4 h-4" />
        <span className="sr-only">{previewingId === doc.id ? 'Abriendo...' : 'Ver'}</span>
      </button>

      <button
        onClick={() => handleDownloadPdf(doc)}
        disabled={downloadingId === doc.id}
        title="Descargar"
        className="h-8 w-8 flex items-center justify-center shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        <span className="sr-only">{downloadingId === doc.id ? 'Generando...' : 'Descargar'}</span>
      </button>
    </>
  );

  const fechaTransporte = (doc: Doc) =>
    doc.route?.plannedStartDate ? new Date(doc.route.plannedStartDate).toLocaleDateString('es-ES') : '—';

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
          <img src={orgLogoUrl} alt={orgName} className="w-9 h-9 object-contain" />
          <h1 className="text-lg font-bold text-slate-800">DeCA Digital</h1>
        </button>
        
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Menú principal">
            <Home className="w-5 h-5" />
          </button>
          <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-bold text-slate-800 max-w-[12rem] truncate">{user.user_metadata?.full_name || 'Usuario'}</span>
            <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
              {isAdmin ? 'Administrador' : 'Transportista'}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
          <button onClick={() => router.push('/cuenta')} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Mi Cuenta">
            <UserCircle className="w-5 h-5" />
          </button>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 xl:px-8 max-w-[1800px] mx-auto w-full flex flex-col gap-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Documentos Activos</h2>
            <p className="text-sm text-slate-500">Panel de gestión y control en tiempo real</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isOrgAdmin && (
              <button
                onClick={() => setShowBulkDownload(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
              >
                <Package className="w-5 h-5" />
                Descargar DeCAs
              </button>
            )}
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
          <>
            {/* PANTALLAS ANCHAS (xl, desde 1280 px): tabla de anchos fijos. El texto largo se
                ajusta en varias líneas en lugar de ensanchar la tabla, así nunca hay scroll horizontal. */}
            <div className="hidden xl:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full table-fixed text-left border-collapse">
                <colgroup>
                  <col className="w-[12rem]" />
                  <col />
                  <col className="w-[8.5rem]" />
                  <col />
                  <col className="w-[6.5rem]" />
                  <col className="w-[11rem]" />
                  <col className="w-[15rem]" />
                </colgroup>
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                  <tr>
                    <th className="px-3 py-4">ID DeCA</th>
                    <th className="px-3 py-4">Transportista</th>
                    <th className="px-3 py-4">Matrícula</th>
                    <th className="px-3 py-4">Ruta</th>
                    <th className="px-3 py-4">Fecha</th>
                    <th className="px-3 py-4">Estado</th>
                    <th className="px-3 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredDecas.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 align-top">
                      <td className="px-3 py-4">
                        <div className="font-mono font-bold text-blue-900">{doc.id}</div>
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                          <span className="shrink-0 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">
                            v{doc.version}.0
                          </span>
                          {doc.internal_title && (
                            <span className="truncate text-xs text-slate-400" title={doc.internal_title}>{doc.internal_title}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 break-words">
                        <div className="line-clamp-3" title={doc.carrier?.companyName || undefined}>{doc.carrier?.companyName || 'Sin asignar'}</div>
                      </td>
                      <td className="px-3 py-4">{renderPlates(doc)}</td>
                      <td className="px-3 py-4 break-words">
                        <div className="line-clamp-2" title={doc.route?.originMain || undefined}>{doc.route?.originMain}</div>
                        <div className="line-clamp-2 text-slate-500" title={doc.route?.destinationMain || undefined}>→ {doc.route?.destinationMain}</div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">{fechaTransporte(doc)}</td>
                      <td className="px-3 py-4">{renderStatusSelect(doc)}</td>
                      <td className="px-3 py-4">
                        <div className="flex justify-end gap-1.5">{renderActions(doc)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PANTALLAS ESTRECHAS (móvil, tablet y portátiles pequeños): una tarjeta por DeCA,
                con los mismos datos y botones, que se adapta al ancho disponible. */}
            <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDecas.map((doc) => (
                <div key={doc.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-blue-900 break-all">{doc.id}</div>
                      {doc.internal_title && (
                        <div className="text-xs text-slate-400 mt-0.5 break-words">{doc.internal_title}</div>
                      )}
                    </div>
                    <span className="shrink-0 bg-slate-100 text-slate-700 px-2.5 py-1 rounded text-xs font-bold border border-slate-200">
                      v{doc.version}.0
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-slate-800 break-words">{doc.carrier?.companyName || 'Sin asignar'}</div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-0.5">Matrícula</div>
                      {renderPlates(doc)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-0.5">Fecha</div>
                      <div>{fechaTransporte(doc)}</div>
                    </div>
                  </div>

                  <div className="text-sm text-slate-600 break-words">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-0.5">Ruta</div>
                    {doc.route?.originMain} → {doc.route?.destinationMain}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <div className="min-w-0 flex-1 basis-40">{renderStatusSelect(doc)}</div>
                    <div className="flex flex-wrap justify-end gap-1.5">{renderActions(doc)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {isOrgAdmin && showBulkDownload && (
        <BulkDownloadModal
          items={decas.map((d): BulkItem => ({
            id: d.id,
            fileName: `${d.id}_v${d.version}.pdf`,
            path: d.pdf_storage_path,
            cacheKey: d.version,
            title: d.carrier?.companyName || 'Sin asignar',
            detail: `${d.route?.originMain ?? ''} → ${d.route?.destinationMain ?? ''}`,
            date: d.route?.plannedStartDate,
            statusKey: d.status,
            badge: `v${d.version}.0`,
            searchText: [d.id, d.carrier?.companyName, d.carrier?.tractorPlate, d.internal_title]
              .filter(Boolean).join(' ').toLowerCase(),
          }))}
          supabase={supabase}
          bucket="decas-pdf"
          publicBucket
          labels={{
            titulo: 'Descargar DeCAs en paquete',
            singular: 'DeCA',
            plural: 'DeCAs',
            buscar: 'Buscar por ID, transportista, matrícula o título...',
            zipPrefijo: 'DeCAs',
          }}
          statusOptions={{
            BORRADOR: 'Borrador',
            EN_TRANSITO: 'En Tránsito',
            ENTREGADO: 'Entregado',
            MODIFICADO_EN_RUTA: 'Modificado en Ruta',
            CANCELADO: 'Cancelado',
          }}
          onClose={() => setShowBulkDownload(false)}
          initialSearch={searchQuery}
          initialStatus={statusFilter}
          initialDateFrom={dateFrom}
          initialDateTo={dateTo}
        />
      )}
    </div>
  );
}