"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { generateOrdenCargaPdf } from '../../utils/pdfGeneratorOrdenCarga';
import { generateSecureId } from '../../utils/generateDecaId';
import { ArrowLeft, FileText, Save } from 'lucide-react';

export default function NuevaOrdenCarga() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [carrierName, setCarrierName] = useState('');
  const [carrierEmail, setCarrierEmail] = useState('');
  const [carrierPhone, setCarrierPhone] = useState('');
  const [carrierPlates, setCarrierPlates] = useState('');
  const [fechaCarga, setFechaCarga] = useState('');
  const [origen, setOrigen] = useState('');
  const [fechaDescarga, setFechaDescarga] = useState('');
  const [destino, setDestino] = useState('');
  const [mercancia, setMercancia] = useState('');
  const [precioConcertado, setPrecioConcertado] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [savedCarriers, setSavedCarriers] = useState<any[]>([]);
  const [savedTractors, setSavedTractors] = useState<any[]>([]);
  const [savedTrailers, setSavedTrailers] = useState<any[]>([]);
  const [selectedTractorPlate, setSelectedTractorPlate] = useState('');
  const [selectedTrailerPlate, setSelectedTrailerPlate] = useState('');

  useEffect(() => {
    const loadFleet = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;
      const [c, t, tr] = await Promise.all([
        supabase.from('carriers').select('*').eq('user_id', uid).order('company_name'),
        supabase.from('tractors').select('*').eq('user_id', uid).order('tractor_plate'),
        supabase.from('trailers').select('*').eq('user_id', uid).order('trailer_plate'),
      ]);
      setSavedCarriers(c.data || []);
      setSavedTractors(t.data || []);
      setSavedTrailers(tr.data || []);
    };
    loadFleet();
  }, []);

  const handleSelectCarrier = (carrierId: string) => {
    const c = savedCarriers.find(c => c.id === carrierId);
    if (c) {
      setCarrierName(c.company_name);
      setCarrierEmail(c.email || '');
      setCarrierPhone(c.phone || '');
    }
  };

  // Al elegir tractora/remolque guardados, combina las matrículas en el campo
  // único de texto (tal como pide la plantilla original), pero lo deja editable.
  const combinarMatriculas = (tractor: string, trailer: string) => {
    const partes = [tractor, trailer].filter(Boolean);
    setCarrierPlates(partes.join(' / '));
  };

  const handleSelectTractor = (tractorId: string) => {
    const t = savedTractors.find(t => t.id === tractorId);
    const plate = t ? t.tractor_plate : '';
    setSelectedTractorPlate(plate);
    combinarMatriculas(plate, selectedTrailerPlate);
  };

  const handleSelectTrailer = (trailerId: string) => {
    const t = savedTrailers.find(t => t.id === trailerId);
    const plate = t ? t.trailer_plate : '';
    setSelectedTrailerPlate(plate);
    combinarMatriculas(selectedTractorPlate, plate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const ordenId = generateSecureId('ORDEN');
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('No hay sesión activa.');

      const orden = {
        id: ordenId,
        fecha,
        carrierName,
        carrierEmail,
        carrierPhone,
        carrierPlates,
        fechaCarga,
        origen,
        fechaDescarga,
        destino,
        mercancia,
        precioConcertado,
        observaciones,
      };

      const { blob, sizeBytes } = await generateOrdenCargaPdf(orden);

      const pdfStoragePath = `${userId}/${ordenId}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('ordenes-carga-pdf')
        .upload(pdfStoragePath, blob, { contentType: 'application/pdf', upsert: true, cacheControl: '0' });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('ordenes_carga').insert([{
        id: ordenId,
        fecha,
        carrier_name: carrierName,
        carrier_email: carrierEmail || null,
        carrier_phone: carrierPhone || null,
        carrier_plates: carrierPlates || null,
        fecha_carga: fechaCarga || null,
        origen: origen || null,
        fecha_descarga: fechaDescarga || null,
        destino: destino || null,
        mercancia: mercancia || null,
        precio_concertado: precioConcertado || null,
        observaciones: observaciones || null,
        pdf_storage_path: pdfStoragePath,
        file_size_bytes: sizeBytes,
        user_id: userId,
      }]);
      if (dbError) throw dbError;

      setCreatedId(ordenId);
    } catch (err: any) {
      setError(err.message || 'Error al generar la orden de carga.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!createdId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    const { data, error } = await supabase.storage.from('ordenes-carga-pdf').download(`${userId}/${createdId}.pdf`);
    if (error || !data) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${createdId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="max-w-2xl mx-auto w-full">
        <button onClick={() => router.push('/carga')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Volver a Órdenes de Carga
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Nueva Orden de Carga
          </h2>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 text-rose-600 p-4 rounded-xl text-sm border border-rose-200">
            {error}
          </div>
        )}

        {createdId ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6 text-center">
            <div className="text-emerald-600 text-lg font-bold">✅ Orden {createdId} generada correctamente</div>
            <button
              type="button"
              onClick={handleDownload}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition"
            >
              Descargar PDF
            </button>
            <p className="text-xs text-slate-400">El envío por WhatsApp y email para esta orden llegará en una próxima actualización.</p>
            <button
              type="button"
              onClick={() => router.push('/carga')}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
            >
              Ir al Panel de Órdenes
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">Transportista</h3>

            {savedCarriers.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <label className="block text-xs font-semibold text-blue-800 mb-1">Rellenar desde transportista guardado</label>
                <select defaultValue="" onChange={e => handleSelectCarrier(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
                  <option value="">-- Escribir a mano --</option>
                  {savedCarriers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Empresa</label>
                <input type="text" required value={carrierName} onChange={e => setCarrierName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input type="email" value={carrierEmail} onChange={e => setCarrierEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
                <input type="tel" value={carrierPhone} onChange={e => setCarrierPhone(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
            </div>

            {(savedTractors.length > 0 || savedTrailers.length > 0) && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedTractors.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-blue-800 mb-1">Tractora guardada</label>
                    <select defaultValue="" onChange={e => handleSelectTractor(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
                      <option value="">-- Ninguna --</option>
                      {savedTractors.map(t => <option key={t.id} value={t.id}>{t.tractor_plate}</option>)}
                    </select>
                  </div>
                )}
                {savedTrailers.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-blue-800 mb-1">Remolque guardado</label>
                    <select defaultValue="" onChange={e => handleSelectTrailer(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
                      <option value="">-- Ninguno --</option>
                      {savedTrailers.map(t => <option key={t.id} value={t.id}>{t.trailer_plate}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Matrículas</label>
              <input type="text" value={carrierPlates} onChange={e => setCarrierPlates(e.target.value)} placeholder="Ej. 9121-LNG / R-0803-BCN" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">Datos del Transporte</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label>
                <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Mercancía</label>
                <input type="text" value={mercancia} onChange={e => setMercancia(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Carga</label>
                <input type="date" value={fechaCarga} onChange={e => setFechaCarga(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Origen</label>
                <input type="text" value={origen} onChange={e => setOrigen(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Descarga</label>
                <input type="date" value={fechaDescarga} onChange={e => setFechaDescarga(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Destino</label>
                <input type="text" value={destino} onChange={e => setDestino(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">Precio y Observaciones</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Precio Concertado</label>
              <input type="text" value={precioConcertado} onChange={e => setPrecioConcertado(e.target.value)} placeholder="Ej. 450€ + IVA" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Observaciones</label>
              <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow transition flex items-center justify-center gap-2 disabled:opacity-50">
            <Save className="w-5 h-5" />
            {loading ? 'Generando...' : 'Generar Orden de Carga'}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
