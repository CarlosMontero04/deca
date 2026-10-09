"use client";

import { useMemo, useState } from 'react';
import JSZip from 'jszip';
import type { SupabaseClient } from '@supabase/supabase-js';
import { X, Download, FolderOpen, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

// Tipos mínimos de la File System Access API (solo Chrome/Edge de escritorio).
// TypeScript aún no los incluye en su librería DOM estándar.
interface FsWritable { write(data: Blob): Promise<void>; close(): Promise<void>; }
interface FsFileHandle { name: string; createWritable(): Promise<FsWritable>; }
interface FsDirHandle {
  name: string;
  getFileHandle(name: string, options: { create: boolean }): Promise<FsFileHandle>;
}
type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FsDirHandle>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FsFileHandle>;
};

interface DecaRow {
  id: string;
  version: number;
  status: string;
  pdf_storage_path?: string | null;
  internal_title?: string | null;
  carrier?: { companyName?: string; tractorPlate?: string } | null;
  route?: { plannedStartDate?: string; originMain?: string; destinationMain?: string } | null;
}

interface Props {
  decas: DecaRow[];
  supabase: SupabaseClient;
  onClose: () => void;
  initialSearch?: string;
  initialStatus?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
}

const STATUS_LABEL: Record<string, string> = {
  BORRADOR: 'Borrador',
  EN_TRANSITO: 'En Tránsito',
  ENTREGADO: 'Entregado',
  MODIFICADO_EN_RUTA: 'Modificado en Ruta',
  CANCELADO: 'Cancelado',
};

// Cuántos PDFs se descargan a la vez. Más de esto no acelera y satura la conexión.
const SIMULTANEOS = 4;
// En modo ZIP el paquete entero se arma en la memoria del navegador.
const MAX_ZIP = 300;

export default function BulkDownloadModal({
  decas, supabase, onClose,
  initialSearch = '', initialStatus = '', initialDateFrom = '', initialDateTo = '',
}: Props) {
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const carpetaSoportada = typeof window !== 'undefined'
    && typeof (window as PickerWindow).showDirectoryPicker === 'function';
  // "Guardar como..." nativo del sistema (Windows/macOS) para el ZIP
  const guardarComoSoportado = typeof window !== 'undefined'
    && typeof (window as PickerWindow).showSaveFilePicker === 'function';
  const [modo, setModo] = useState<'carpeta' | 'zip'>(carpetaSoportada ? 'carpeta' : 'zip');
  const [dirHandle, setDirHandle] = useState<FsDirHandle | null>(null);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [resultado, setResultado] = useState<{ ok: number; fallos: string[]; destino: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const filtrados = useMemo(() => decas.filter(doc => {
    if (q) {
      const coincide = doc.id?.toLowerCase().includes(q)
        || doc.carrier?.companyName?.toLowerCase().includes(q)
        || doc.carrier?.tractorPlate?.toLowerCase().includes(q)
        || doc.internal_title?.toLowerCase().includes(q);
      if (!coincide) return false;
    }
    if (status && doc.status !== status) return false;
    const fecha = doc.route?.plannedStartDate ? doc.route.plannedStartDate.slice(0, 10) : '';
    if (dateFrom && fecha < dateFrom) return false;
    if (dateTo && fecha > dateTo) return false;
    return true;
  }), [decas, q, status, dateFrom, dateTo]);

  // Solo se pueden empaquetar los DeCAs que tienen su PDF guardado.
  const seleccionables = filtrados.filter(d => !!d.pdf_storage_path);
  const seleccionados = decas.filter(d => selected.has(d.id) && !!d.pdf_storage_path);
  const todosMarcados = seleccionables.length > 0 && seleccionables.every(d => selected.has(d.id));

  const alternar = (id: string) => setSelected(prev => {
    const nuevo = new Set(prev);
    if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
    return nuevo;
  });

  const alternarTodos = () => setSelected(prev => {
    const nuevo = new Set(prev);
    if (todosMarcados) seleccionables.forEach(d => nuevo.delete(d.id));
    else seleccionables.forEach(d => nuevo.add(d.id));
    return nuevo;
  });

  const elegirCarpeta = async () => {
    setError(null);
    try {
      const handle = await (window as PickerWindow).showDirectoryPicker!({ mode: 'readwrite' });
      setDirHandle(handle);
    } catch (e) {
      // Cerrar el selector sin elegir no es un error
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError('No se pudo abrir el selector de carpetas. Prueba con la opción de archivo ZIP.');
    }
  };

  const puedeDescargar = !running && seleccionados.length > 0
    && (modo === 'zip' ? seleccionados.length <= MAX_ZIP : !!dirHandle);

  const descargar = async () => {
    if (!puedeDescargar) return;
    setError(null);
    setResultado(null);

    // El cuadro "Guardar como..." solo se puede abrir como respuesta directa al clic
    // del usuario, así que se pide ANTES de empezar a descargar los PDFs.
    let ficheroZip: FsFileHandle | null = null;
    if (modo === 'zip' && guardarComoSoportado) {
      try {
        ficheroZip = await (window as PickerWindow).showSaveFilePicker!({
          suggestedName: `DeCAs_${new Date().toISOString().slice(0, 10)}.zip`,
          types: [{ description: 'Archivo ZIP', accept: { 'application/zip': ['.zip'] } }],
        });
      } catch (e) {
        // Cerrar el cuadro sin elegir ruta = cancelar, no es un error
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError('No se pudo abrir el cuadro para elegir dónde guardar el ZIP.');
        return;
      }
    }

    setRunning(true);
    const lote = [...seleccionados];
    setProgress({ done: 0, total: lote.length });

    const fallos: string[] = [];
    let hechos = 0;
    const zip = modo === 'zip' ? new JSZip() : null;
    const cola = [...lote];

    const trabajador = async () => {
      while (cola.length > 0) {
        const doc = cola.shift()!;
        const nombre = `${doc.id}_v${doc.version}.pdf`;
        try {
          const { data } = supabase.storage.from('decas-pdf').getPublicUrl(doc.pdf_storage_path!);
          const res = await fetch(`${data.publicUrl}?v=${doc.version}`, { cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          if (blob.size === 0) throw new Error('PDF vacío');
          if (zip) {
            zip.file(nombre, blob);
          } else if (dirHandle) {
            const fichero = await dirHandle.getFileHandle(nombre, { create: true });
            const escritura = await fichero.createWritable();
            await escritura.write(blob);
            await escritura.close();
          }
        } catch (e) {
          console.error(`[descarga en paquete] ${doc.id}:`, e);
          fallos.push(doc.id);
        }
        hechos++;
        setProgress({ done: hechos, total: lote.length });
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(SIMULTANEOS, lote.length) }, trabajador));

      const correctos = lote.length - fallos.length;
      let destino = '';
      if (zip) {
        if (correctos > 0) {
          // Los PDF ya van comprimidos: guardamos tal cual (STORE), es mucho más rápido.
          const contenido = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
          if (ficheroZip) {
            // Se escribe directamente en la ruta que eligió el usuario
            const escritura = await ficheroZip.createWritable();
            await escritura.write(contenido);
            await escritura.close();
          } else {
            // Navegadores sin "Guardar como...": descarga normal a la carpeta de descargas
            const url = URL.createObjectURL(contenido);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DeCAs_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          }
        }
        destino = ficheroZip ? `el archivo «${ficheroZip.name}»` : 'tu carpeta de descargas, en un archivo ZIP';
      } else {
        destino = `la carpeta «${dirHandle?.name ?? ''}»`;
      }
      setResultado({ ok: correctos, fallos, destino });
    } catch (e) {
      console.error('[descarga en paquete]', e);
      setError('Ha ocurrido un error durante la descarga. Inténtalo de nuevo.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Descargar DeCAs en paquete">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Descargar DeCAs en paquete</h3>
            <p className="text-xs text-slate-500">Filtra, marca los que quieras y elige dónde guardarlos.</p>
          </div>
          <button onClick={onClose} disabled={running} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-40" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row flex-wrap gap-2 shrink-0">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ID, transportista, matrícula o título..."
            className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg text-sm text-slate-900"
          />
          <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
            <span className="text-slate-400 text-sm">a</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
          </div>
        </div>

        <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs shrink-0">
          <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} disabled={seleccionables.length === 0 || running} className="w-4 h-4" />
            Seleccionar todos los que se ven ({seleccionables.length})
          </label>
          <span className="text-slate-500">
            <strong className="text-slate-800">{seleccionados.length}</strong> seleccionados
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} disabled={running} className="ml-3 font-semibold text-blue-600 hover:underline disabled:opacity-40">Quitar selección</button>
            )}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-[160px]">
          {filtrados.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-400">Ningún DeCA coincide con esos filtros.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {filtrados.map(doc => {
                const sinPdf = !doc.pdf_storage_path;
                return (
                  <li key={doc.id}>
                    <label className={`flex items-center gap-3 px-6 py-2.5 ${sinPdf ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}>
                      <input
                        type="checkbox" className="w-4 h-4 shrink-0"
                        checked={selected.has(doc.id) && !sinPdf}
                        disabled={sinPdf || running}
                        onChange={() => alternar(doc.id)}
                      />
                      <span className="font-mono font-bold text-blue-900 w-44 shrink-0">{doc.id}</span>
                      <span className="flex-1 min-w-0 truncate text-slate-700">
                        {doc.carrier?.companyName || 'Sin asignar'}
                        <span className="text-slate-400"> · {doc.route?.originMain} → {doc.route?.destinationMain}</span>
                      </span>
                      <span className="hidden sm:block text-slate-500 whitespace-nowrap">
                        {doc.route?.plannedStartDate ? new Date(doc.route.plannedStartDate).toLocaleDateString('es-ES') : '—'}
                      </span>
                      <span className="hidden sm:block text-xs text-slate-500 w-32 truncate">{STATUS_LABEL[doc.status] ?? doc.status}</span>
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">v{doc.version}.0</span>
                      {sinPdf && <span className="text-[10px] text-amber-600 font-semibold">Sin PDF guardado</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Guardar en</span>
            <div className="flex gap-2 flex-wrap items-center">
              {carpetaSoportada && (
                <>
                  <button
                    onClick={() => setModo('carpeta')} disabled={running}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${modo === 'carpeta' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300'}`}
                  >
                    Una carpeta (PDFs sueltos)
                  </button>
                </>
              )}
              <button
                onClick={() => setModo('zip')} disabled={running}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${modo === 'zip' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300'}`}
              >
                Un archivo ZIP
              </button>
              {modo === 'carpeta' && (
                <button
                  onClick={elegirCarpeta} disabled={running}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <FolderOpen className="w-4 h-4" />
                  {dirHandle ? `Carpeta: ${dirHandle.name}` : 'Elegir carpeta...'}
                </button>
              )}
            </div>
          </div>

          {modo === 'zip' && guardarComoSoportado && (
            <p className="text-[11px] text-slate-500">Al pulsar «Descargar» se abrirá el cuadro de Windows para elegir dónde guardar el ZIP.</p>
          )}
          {!guardarComoSoportado && !carpetaSoportada && (
            <p className="text-[11px] text-slate-500">
              Tu navegador no permite elegir la ruta de destino (solo Chrome o Edge en ordenador). Se descargará un único ZIP a tu carpeta de descargas.
            </p>
          )}
          {modo === 'zip' && seleccionados.length > MAX_ZIP && (
            <p className="text-xs text-amber-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />Para un ZIP, selecciona como máximo {MAX_ZIP} DeCAs a la vez (o usa la opción de carpeta).</p>
          )}
          {modo === 'carpeta' && !dirHandle && seleccionados.length > 0 && !running && (
            <p className="text-xs text-slate-500">Elige primero la carpeta donde guardar los PDFs.</p>
          )}

          {running && (
            <div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-1">Descargando {progress.done} de {progress.total}...</p>
            </div>
          )}

          {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

          {resultado && (
            <div className={`text-xs rounded-lg p-3 flex gap-2 ${resultado.fallos.length ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
              {resultado.fallos.length ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <div>
                <p className="font-semibold">
                  {resultado.ok > 0 ? `${resultado.ok} DeCA${resultado.ok === 1 ? '' : 's'} guardado${resultado.ok === 1 ? '' : 's'} en ${resultado.destino}.` : 'No se ha podido descargar ningún DeCA.'}
                </p>
                {resultado.fallos.length > 0 && (
                  <p className="mt-0.5">No se pudieron descargar: {resultado.fallos.join(', ')}. Vuelve a intentarlo con esos.</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={running} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40">
              {resultado ? 'Cerrar' : 'Cancelar'}
            </button>
            <button
              onClick={descargar} disabled={!puedeDescargar}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {running ? 'Descargando...' : `Descargar ${seleccionados.length || ''} ${seleccionados.length === 1 ? 'DeCA' : 'DeCAs'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
