"use client";

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '../../../utils/supabase/client';
import { generateOrdenCargaPdf } from '../../../utils/pdfGeneratorOrdenCarga';
import { notifyCarrierOrden } from '../../../utils/notifyCarrierOrden';
import { ArrowLeft, FileEdit, Save } from 'lucide-react';

export default function ModificarOrdenCarga() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pdfStoragePath, setPdfStoragePath] = useState('');
  const [notifySending, setNotifySending] = useState<'telefono' | 'email' | null>(null);
  const [notifyResult, setNotifyResult] = useState<{ success: boolean; error?: string } | null>(null);

  const [fecha, setFecha] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [carrierEmail, setCarrierEmail] = useState('');
  const [carrierPhone, setCarrierPhone] = useState('');
  const [carrierPlates, setCarrierPlates] = useState('');
  const [fechaCarga, setFechaCarga] = useState('');
  const [horaCarga, setHoraCarga] = useState('');
  const [origen, setOrigen] = useState('');
  const [fechaDescarga, setFechaDescarga] = useState('');
  const [horaDescarga, setHoraDescarga] = useState('');
  const [destino, setDestino] = useState('');
  const [mercancia, setMercancia] = useState('');
  const [precioConcertado, setPrecioConcertado] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [savedCarriers, setSavedCarriers] = useState<any[]>([]);
  const [savedTractors, setSavedTractors] = useState<any[]>([]);
  const [savedTrailers, setSavedTrailers] = useState<any[]>([]);
  const mercanciaRef = useRef<HTMLTextAreaElement>(null);
  const observacionesRef = useRef<HTMLTextAreaElement>(null);
  const carrierNameRef = useRef<HTMLTextAreaElement>(null);
  const carrierEmailRef = useRef<HTMLTextAreaElement>(null);
  const carrierPhoneRef = useRef<HTMLTextAreaElement>(null);
  const carrierPlatesRef = useRef<HTMLTextAreaElement>(null);
  const origenRef = useRef<HTMLTextAreaElement>(null);
  const destinoRef = useRef<HTMLTextAreaElement>(null);
  const precioRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const resizeEl = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const uid = session.user.id;

      const [ordenRes, c, t, tr] = await Promise.all([
        supabase.from('ordenes_carga').select('*').eq('id', id).single(),
        supabase.from('carriers').select('*').order('company_name'),
        supabase.from('tractors').select('*').order('tractor_plate'),
        supabase.from('trailers').select('*').order('trailer_plate'),
      ]);

      if (ordenRes.data) {
        const o = ordenRes.data;
        setFecha(o.fecha || '');
        setCarrierName(o.carrier_name || '');
        setCarrierEmail(o.carrier_email || '');
        setCarrierPhone(o.carrier_phone || '');
        setCarrierPlates(o.carrier_plates || '');
        setFechaCarga(o.fecha_carga || '');
        setHoraCarga(o.hora_carga || '');
        setOrigen(o.origen || '');
        setFechaDescarga(o.fecha_descarga || '');
        setHoraDescarga(o.hora_descarga || '');
        setDestino(o.destino || '');
        setMercancia(o.mercancia || '');
        setPrecioConcertado(o.precio_concertado || '');
        setObservaciones(o.observaciones || '');
        setPdfStoragePath(o.pdf_storage_path || '');
      }
      setSavedCarriers(c.data || []);
      setSavedTractors(t.data || []);
      setSavedTrailers(tr.data || []);
      setLoading(false);
    };
    load();
  }, [id]);

  // Se ejecuta ante CUALQUIER cambio de estos valores — al cargar la orden,
  // al escribir, o al seleccionar algo del desplegable de flota — así todas
  // las cajas se ajustan siempre, no solo cuando escribes directamente.
  useLayoutEffect(() => {
    if (!loading) {
      [carrierNameRef, carrierEmailRef, carrierPhoneRef, carrierPlatesRef, origenRef, destinoRef, precioRef, mercanciaRef, observacionesRef]
        .forEach(r => resizeEl(r.current));
    }
  }, [loading, carrierName, carrierEmail, carrierPhone, carrierPlates, origen, destino, precioConcertado, mercancia, observaciones]);

  const handleSelectCarrier = (carrierId: string) => {
    const c = savedCarriers.find(c => c.id === carrierId);
    if (c) {
      setCarrierName(c.company_name);
      setCarrierEmail(c.email || '');
      setCarrierPhone(c.phone || '');
    }
  };

  const handleSelectTractor = (tractorId: string) => {
    const t = savedTractors.find(t => t.id === tractorId);
    if (t) setCarrierPlates(prev => {
      const remolque = prev.includes('/') ? prev.split('/')[1]?.trim() : '';
      return [t.tractor_plate, remolque].filter(Boolean).join(' / ');
    });
  };

  const handleSelectTrailer = (trailerId: string) => {
    const t = savedTrailers.find(t => t.id === trailerId);
    if (t) setCarrierPlates(prev => {
      const tractora = prev.includes('/') ? prev.split('/')[0]?.trim() : prev.trim();
      return [tractora, t.trailer_plate].filter(Boolean).join(' / ');
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const orden = {
        id, fecha, carrierName, carrierEmail, carrierPhone, carrierPlates,
        fechaCarga, horaCarga, origen, fechaDescarga, horaDescarga, destino, mercancia, precioConcertado, observaciones,
      };

      const { blob, sizeBytes } = await generateOrdenCargaPdf(orden);

      if (pdfStoragePath) {
        const { error: uploadError } = await supabase.storage
          .from('ordenes-carga-pdf')
          .upload(pdfStoragePath, blob, { contentType: 'application/pdf', upsert: true, cacheControl: '0' });
        if (uploadError) throw uploadError;
      }

      const { error: dbError } = await supabase.from('ordenes_carga').update({
        fecha,
        carrier_name: carrierName,
        carrier_email: carrierEmail || null,
        carrier_phone: carrierPhone || null,
        carrier_plates: carrierPlates || null,
        fecha_carga: fechaCarga || null,
        hora_carga: horaCarga || null,
        origen: origen || null,
        fecha_descarga: fechaDescarga || null,
        hora_descarga: horaDescarga || null,
        destino: destino || null,
        mercancia: mercancia || null,
        precio_concertado: precioConcertado || null,
        observaciones: observaciones || null,
        file_size_bytes: sizeBytes,
      }).eq('id', id);
      if (dbError) throw dbError;

      setSaved(true);
    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Cargando orden de carga...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="max-w-2xl mx-auto w-full">
        <button onClick={() => router.push('/carga')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Volver a Órdenes de Carga
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileEdit className="w-6 h-6 text-amber-500" />
            Modificar Orden de Carga
          </h2>
          <div className="mt-4 inline-block bg-slate-100 px-3 py-1 rounded font-mono text-sm font-bold text-slate-700">
            {id}
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 text-rose-600 p-4 rounded-xl text-sm border border-rose-200">
            {error}
          </div>
        )}

        {saved ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6 text-center">
            <div className="text-emerald-600 text-lg font-bold">✅ Orden actualizada correctamente</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!carrierPhone || notifySending !== null}
                onClick={async () => {
                  setNotifySending('telefono');
                  setNotifyResult(null);
                  const r = await notifyCarrierOrden(supabase, 'telefono', carrierPhone, carrierEmail, id, pdfStoragePath, `Se ha actualizado la Orden de Carga ${id}.`);
                  setNotifySending(null);
                  setNotifyResult(r);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition disabled:opacity-40"
              >
                {notifySending === 'telefono' ? 'Enviando...' : 'Enviar por WhatsApp'}
              </button>
              <button
                type="button"
                disabled={!carrierEmail || notifySending !== null}
                onClick={async () => {
                  setNotifySending('email');
                  setNotifyResult(null);
                  const r = await notifyCarrierOrden(supabase, 'email', carrierPhone, carrierEmail, id, pdfStoragePath, `Se ha actualizado la Orden de Carga ${id}, adjunta en PDF.`);
                  setNotifySending(null);
                  setNotifyResult(r);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition disabled:opacity-40"
              >
                {notifySending === 'email' ? 'Enviando...' : 'Enviar por Email'}
              </button>
            </div>
            {notifyResult?.success && (
              <p className="text-sm text-emerald-600 font-semibold">✓ Enviado correctamente</p>
            )}
            {notifyResult && !notifyResult.success && (
              <p className="text-sm text-rose-600 font-semibold">✗ {notifyResult.error}</p>
            )}
            <button
              type="button"
              onClick={() => router.push('/carga')}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
            >
              Ir al Panel de Órdenes
            </button>
          </div>
        ) : (
        <form
          onSubmit={handleUpdate}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
          className="space-y-6"
        >

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">Transportista</h3>

            {savedCarriers.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <label className="block text-xs font-semibold text-blue-800 mb-1">Rellenar desde transportista guardado</label>
                <select defaultValue="" onChange={e => handleSelectCarrier(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
                  <option value="">-- No cambiar --</option>
                  {savedCarriers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Empresa</label>
                <textarea ref={carrierNameRef} required value={carrierName} onChange={e => { setCarrierName(e.target.value); autoResize(e); }} rows={1} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <textarea ref={carrierEmailRef} inputMode="email" value={carrierEmail} onChange={e => { setCarrierEmail(e.target.value); autoResize(e); }} rows={1} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
                <textarea ref={carrierPhoneRef} inputMode="tel" value={carrierPhone} onChange={e => { setCarrierPhone(e.target.value); autoResize(e); }} rows={1} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
            </div>

            {(savedTractors.length > 0 || savedTrailers.length > 0) && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedTractors.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-blue-800 mb-1">Tractora guardada</label>
                    <select defaultValue="" onChange={e => handleSelectTractor(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
                      <option value="">-- No cambiar --</option>
                      {savedTractors.map(t => <option key={t.id} value={t.id}>{t.tractor_plate}</option>)}
                    </select>
                  </div>
                )}
                {savedTrailers.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-blue-800 mb-1">Remolque guardado</label>
                    <select defaultValue="" onChange={e => handleSelectTrailer(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
                      <option value="">-- No cambiar --</option>
                      {savedTrailers.map(t => <option key={t.id} value={t.id}>{t.trailer_plate}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Matrículas</label>
              <textarea ref={carrierPlatesRef} value={carrierPlates} onChange={e => { setCarrierPlates(e.target.value); autoResize(e); }} rows={1} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">Datos del Transporte</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label>
                <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Mercancía</label>
                <textarea
                  ref={mercanciaRef}
                  value={mercancia}
                  onChange={e => { setMercancia(e.target.value); autoResize(e); }}
                  rows={1}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Carga</label>
                <input type="date" value={fechaCarga} onChange={e => setFechaCarga(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Hora de Carga (opcional)</label>
                <input type="time" value={horaCarga} onChange={e => setHoraCarga(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Descarga</label>
                <input type="date" value={fechaDescarga} onChange={e => setFechaDescarga(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Hora de Descarga (opcional)</label>
                <input type="time" value={horaDescarga} onChange={e => setHoraDescarga(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Origen</label>
                <textarea ref={origenRef} value={origen} onChange={e => { setOrigen(e.target.value); autoResize(e); }} rows={1} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Destino</label>
                <textarea ref={destinoRef} value={destino} onChange={e => { setDestino(e.target.value); autoResize(e); }} rows={1} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">Precio y Observaciones</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Precio Concertado</label>
              <textarea ref={precioRef} value={precioConcertado} onChange={e => { setPrecioConcertado(e.target.value); autoResize(e); }} rows={1} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Observaciones</label>
              <textarea
                ref={observacionesRef}
                value={observaciones}
                onChange={e => { setObservaciones(e.target.value); autoResize(e); }}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden"
              />
            </div>
          </div>

          <button type="submit" disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl shadow transition flex items-center justify-center gap-2 disabled:opacity-50">
            <Save className="w-5 h-5" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
