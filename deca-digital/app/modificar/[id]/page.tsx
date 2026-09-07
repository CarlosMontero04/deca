"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { FileEdit, ArrowLeft, Save, AlertTriangle } from 'lucide-react';
import { generateDecaPdf } from '@/app/utils/pdfGenerator';
import { notifyDriver, NotificationMethod } from '@/app/utils/notifyDriver';

export default function ModificarDeca() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [deca, setDeca] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos editables, precargados con el valor actual del documento.
  // Solo se registra en el historial lo que realmente cambie al guardar.
  const [tractorPlate, setTractorPlate] = useState('');
  const [trailerPlate, setTrailerPlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverDni, setDriverDni] = useState('');
  const [phone, setPhone] = useState('');
  const [transportDate, setTransportDate] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [goodsDescription, setGoodsDescription] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [observationsField, setObservationsField] = useState('');

  // Contacto del conductor: no se trackea en el historial, solo sirve para avisarle
  const [driverEmail, setDriverEmail] = useState('');
  const [notifyMethod, setNotifyMethod] = useState<NotificationMethod>('telefono');

  // Motivo y detalle narrativo, aplican a todos los cambios de este envío
  const [motivo, setMotivo] = useState('CAMBIO_VEHICULO');
  const [detalle, setDetalle] = useState('');

  // Tras guardar con éxito, guardamos aquí lo necesario para notificar al conductor
  // mediante un clic explícito (ver por qué en notifyDriver.ts)
  const [updatedInfo, setUpdatedInfo] = useState<{
    id: string; version: number; verificationUrl: string; phone: string; email?: string; method: NotificationMethod; motivo: string;
  } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const fetchDeca = async () => {
      const { data } = await supabase.from('decas').select('*').eq('id', id).single();
      if (data) {
        setDeca(data);
        setTractorPlate(data.carrier?.tractorPlate || '');
        setTrailerPlate(data.carrier?.trailerPlate || '');
        setDriverName(data.carrier?.driverName || '');
        setDriverDni(data.carrier?.driverDni || '');
        setPhone(data.carrier?.phone || '');
        setDriverEmail(data.carrier?.driverEmail || '');
        setTransportDate(data.route?.plannedStartDate ? new Date(data.route.plannedStartDate).toISOString().slice(0, 10) : '');
        setOrigin(data.route?.originMain || '');
        setDestination(data.route?.destinationMain || '');
        setGoodsDescription(data.shipments?.[0]?.goodsDescription || '');
        setGrossWeight(String(data.shipments?.[0]?.grossWeightKg ?? ''));
        setObservationsField(data.observations || '');
      }
      setLoading(false);
    };
    fetchDeca();
  }, [id, supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Comparamos cada campo editable contra su valor original para saber qué cambió de verdad
    const original = {
      tractorPlate: deca.carrier?.tractorPlate || '',
      trailerPlate: deca.carrier?.trailerPlate || '',
      driverName: deca.carrier?.driverName || '',
      driverDni: deca.carrier?.driverDni || '',
      phone: deca.carrier?.phone || '',
      transportDate: deca.route?.plannedStartDate ? new Date(deca.route.plannedStartDate).toISOString().slice(0, 10) : '',
      origin: deca.route?.originMain || '',
      destination: deca.route?.destinationMain || '',
      goodsDescription: deca.shipments?.[0]?.goodsDescription || '',
      grossWeight: String(deca.shipments?.[0]?.grossWeightKg ?? ''),
      observations: deca.observations || ''
    };

    const candidatos = [
      { field: 'tractorPlate', label: 'Matrícula Tractora', previousValue: original.tractorPlate, newValue: tractorPlate },
      { field: 'trailerPlate', label: 'Matrícula Remolque', previousValue: original.trailerPlate, newValue: trailerPlate },
      { field: 'driverName', label: 'Nombre Conductor', previousValue: original.driverName, newValue: driverName },
      { field: 'driverDni', label: 'DNI Conductor', previousValue: original.driverDni, newValue: driverDni },
      { field: 'phone', label: 'Teléfono de Contacto', previousValue: original.phone, newValue: phone },
      { field: 'transportDate', label: 'Fecha de Realización del Transporte', previousValue: original.transportDate, newValue: transportDate },
      { field: 'origin', label: 'Lugar de Origen', previousValue: original.origin, newValue: origin },
      { field: 'destination', label: 'Lugar de Destino', previousValue: original.destination, newValue: destination },
      { field: 'goodsDescription', label: 'Naturaleza de la Mercancía', previousValue: original.goodsDescription, newValue: goodsDescription },
      { field: 'grossWeight', label: 'Peso Bruto (Kg)', previousValue: original.grossWeight, newValue: grossWeight },
      { field: 'observations', label: 'Observaciones', previousValue: original.observations, newValue: observationsField },
    ];

    const cambios = candidatos.filter(c => c.previousValue !== c.newValue);

    if (cambios.length === 0 && !detalle.trim()) {
      setError('No has modificado ningún dato ni indicado un detalle. Cambia algún campo o escribe un detalle.');
      return;
    }

    setSaving(true);

    try {
      const nuevaVersion = deca.version + 1;
      const { data: { session } } = await supabase.auth.getSession();
      const modifiedBy = session?.user?.user_metadata?.full_name || 'Transportista';
      const timestamp = new Date().toISOString();

      // Una entrada de historial por CADA campo que cambió, con su antes/después.
      // Si no hubo campos estructurados pero sí un detalle (ej. avería en ruta sin
      // cambiar ningún dato), se guarda igualmente una entrada narrativa.
      const entradasHistorial = cambios.length > 0
        ? cambios.map(c => ({
            version: nuevaVersion,
            timestamp,
            field: c.label,
            reason: motivo,
            details: detalle,
            previousValue: c.previousValue,
            newValue: c.newValue,
            modifiedBy,
            qrHash: `HASH-MOD-${id}-${Date.now().toString().slice(-6)}-${c.field}`
          }))
        : [{
            version: nuevaVersion,
            timestamp,
            reason: motivo,
            details: detalle,
            modifiedBy,
            qrHash: `HASH-MOD-${id}-${Date.now().toString().slice(-6)}`
          }];

      const nuevoHistorial = [...(deca.history || []), ...entradasHistorial];

      // Aplicamos los cambios a copias actualizadas de cada bloque de datos del documento
      const nuevoCarrier = {
        ...deca.carrier,
        tractorPlate,
        trailerPlate,
        driverName,
        driverDni,
        phone,
        driverEmail: driverEmail || undefined,
      };
      const nuevoRoute = {
        ...deca.route,
        originMain: origin,
        destinationMain: destination,
        plannedStartDate: new Date(transportDate).toISOString(),
      };
      const nuevosShipments = (deca.shipments || []).map((s: any, idx: number) =>
        idx === 0
          ? { ...s, originAddress: origin, destinationAddress: destination, goodsDescription, grossWeightKg: parseFloat(grossWeight) || 0 }
          : s
      );

      const decaData = {
        id: deca.id,
        version: nuevaVersion,
        creationDate: deca.creation_date,
        status: deca.status,
        carrier: nuevoCarrier,
        contractualShipper: deca.contractual_shipper,
        shipments: nuevosShipments,
        route: nuevoRoute,
        history: nuevoHistorial,
        digitalSignature: deca.digital_signature,
        fileSizeBytes: deca.file_size_bytes || 0,
        legalRetentionExpiresDate: deca.legal_retention_expires_date || '',
        qrUrl: deca.qr_url,
        observations: observationsField
      };

      // Regeneramos el PDF con todos los datos actualizados y el historial completo
      const { blob, sizeBytes } = await generateDecaPdf(decaData, decaData.qrUrl);

      // Sobrescribimos el MISMO fichero en Storage (mismo path = misma URL/QR de siempre,
      // método 1 del apartado Quinto: modificar el PDF existente sin cambiar su URL)
      if (deca.pdf_storage_path) {
        const { error: uploadError } = await supabase.storage
          .from('decas-pdf')
          .upload(deca.pdf_storage_path, blob, { contentType: 'application/pdf', upsert: true, cacheControl: '0' });
        if (uploadError) throw uploadError;
      }

      // Actualizamos en Supabase — ahora también los datos reales, no solo el historial
      const { error: dbError } = await supabase
        .from('decas')
        .update({
          version: nuevaVersion,
          history: nuevoHistorial,
          file_size_bytes: sizeBytes,
          carrier: nuevoCarrier,
          route: nuevoRoute,
          shipments: nuevosShipments,
          observations: observationsField
        })
        .eq('id', id);

      if (dbError) throw dbError;

      // No notificamos aquí automáticamente: los navegadores bloquean en silencio
      // los window.open()/mailto disparados después de un await (como este update).
      // Guardamos lo necesario y mostramos un botón explícito en pantalla.
      setUpdatedInfo({
        id: deca.id,
        version: nuevaVersion,
        verificationUrl: deca.qr_url,
        phone: nuevoCarrier.phone,
        email: nuevoCarrier.driverEmail,
        method: notifyMethod,
        motivo
      });
      setSaving(false);

    } catch (err) {
      console.error(err);
      alert("Error al guardar la modificación");
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Cargando documento...</div>;
  if (!deca) return <div className="p-10 text-center text-rose-600">Documento no encontrado</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="max-w-2xl mx-auto w-full">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Volver al Tablero
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileEdit className="w-6 h-6 text-amber-500" />
            Modificar Documento de Control
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Cambia solo los datos que necesites actualizar; el resto se deja igual. Cada dato que cambies quedará registrado con su valor anterior y el nuevo, tal como exige la normativa.
          </p>
          <div className="mt-4 inline-block bg-slate-100 px-3 py-1 rounded font-mono text-sm font-bold text-slate-700">
            Editando ID: {deca.id} (Versión actual: v{deca.version}.0)
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 text-rose-600 p-4 rounded-xl text-sm border border-rose-200">
            {error}
          </div>
        )}

        {updatedInfo ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6 text-center">
            <div className="text-emerald-600 text-lg font-bold">✅ DeCA {updatedInfo.id} actualizado a v{updatedInfo.version}.0</div>
            <p className="text-sm text-slate-500">
              El conductor debe recibir la versión actualizada antes de continuar el servicio. Pulsa el botón para abrir {updatedInfo.method === 'telefono' ? 'WhatsApp' : 'tu cliente de correo'} con el mensaje ya preparado.
            </p>
            <button
              type="button"
              onClick={() => notifyDriver(updatedInfo.method, updatedInfo.phone, updatedInfo.email,
                `Se ha actualizado tu Documento de Control (DeCA) ${updatedInfo.id} a la versión v${updatedInfo.version}.0. Motivo: ${updatedInfo.motivo}.`,
                updatedInfo.verificationUrl)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition"
            >
              Notificar al conductor {updatedInfo.method === 'telefono' ? 'por WhatsApp' : 'por Email'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
            >
              Ir al Tablero
            </button>
          </div>
        ) : (
        <form onSubmit={handleUpdate} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-800 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>Al guardar, el documento pasará a la <strong>versión v{deca.version + 1}.0</strong>. El código QR seguirá siendo el mismo.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Matrícula Tractora</label>
              <input type="text" value={tractorPlate} onChange={e => setTractorPlate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Matrícula Remolque</label>
              <input type="text" value={trailerPlate} onChange={e => setTrailerPlate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Conductor</label>
              <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">DNI Conductor</label>
              <input type="text" value={driverDni} onChange={e => setDriverDni(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono de Contacto</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Realización del Transporte</label>
              <input type="date" value={transportDate} onChange={e => setTransportDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Peso Bruto (Kg)</label>
              <input type="text" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lugar de Origen</label>
              <input type="text" value={origin} onChange={e => setOrigin(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lugar de Destino</label>
              <input type="text" value={destination} onChange={e => setDestination(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Naturaleza de la Mercancía</label>
              <input type="text" value={goodsDescription} onChange={e => setGoodsDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Observaciones</label>
              <textarea value={observationsField} onChange={e => setObservationsField(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo Oficial de la Modificación</label>
              <select
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900"
              >
                <option value="CAMBIO_VEHICULO">Cambio de Vehículo / Tractora</option>
                <option value="CAMBIO_CONDUCTOR">Cambio de Conductor</option>
                <option value="RESERVA_ESTADO_MERCANCIA">Reserva sobre el estado de la mercancía</option>
                <option value="INCIDENCIA_RUTA">Incidencia grave en ruta (Avería / Accidente)</option>
                <option value="VARIACION_DESTINO">Variación de destino</option>
                <option value="OTRO">Otro motivo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Detalle (Sustituye a la anotación manuscrita)</label>
              <textarea
                value={detalle}
                onChange={e => setDetalle(e.target.value)}
                rows={3}
                placeholder="Ej. El camión averió en el km 120. Se transborda la carga al remolque R-9999-XYZ..."
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Notificar al conductor la versión actualizada</h3>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="notifyMethod" checked={notifyMethod === 'telefono'} onChange={() => setNotifyMethod('telefono')} />
                Por teléfono (WhatsApp)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="notifyMethod" checked={notifyMethod === 'email'} onChange={() => setNotifyMethod('email')} />
                Por email
              </label>
            </div>
            {notifyMethod === 'email' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email del Conductor</label>
                <input type="email" value={driverEmail} onChange={e => setDriverEmail(e.target.value)} placeholder="conductor@ejemplo.com" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
            )}
          </div>

          <button type="submit" disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl shadow transition flex items-center justify-center gap-2">
            <Save className="w-5 h-5" />
            {saving ? 'Guardando...' : 'Guardar Modificación'}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}