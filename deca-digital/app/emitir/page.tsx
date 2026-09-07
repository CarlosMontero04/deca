"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ArrowLeft, Save, Truck } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import { generateDecaPdf } from '../utils/pdfGenerator';
import { notifyDriver, NotificationMethod } from '../utils/notifyDriver';
import { DecaDocument } from '../types';

// Dominio canónico único de la app — usado en el QR y en la URL de verificación
// para que ambos coincidan siempre (antes había dos dominios distintos mezclados).
const APP_URL = 'https://deca-ochre.vercel.app';

export default function EmitirDeca() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bloque A: Cargador Contractual
  const [shipperName, setShipperName] = useState('');
  const [shipperCif, setShipperCif] = useState('');
  const [shipperAddress, setShipperAddress] = useState('');

  // Bloque B: Transportista Efectivo
  const [carrierName, setCarrierName] = useState('');
  const [carrierCif, setCarrierCif] = useState('');
  const [carrierAddress, setCarrierAddress] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverDni, setDriverDni] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  const [notifyMethod, setNotifyMethod] = useState<NotificationMethod>('telefono');

  // Bloque C: Origen y Destino
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');

  // Bloque E: Fecha de Realización del Transporte
  const [transportDate, setTransportDate] = useState('');

  // Bloque D: Mercancía
  const [goodsDesc, setGoodsDesc] = useState('');
  const [packageCount, setPackageCount] = useState('');
  const [grossWeight, setGrossWeight] = useState('');

  // Bloque F: Matrículas
  const [tractorPlate, setTractorPlate] = useState('');
  const [trailerPlate, setTrailerPlate] = useState('');

  // Bloque G: Observaciones
  const [observations, setObservations] = useState('');

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const decaId = `DECA-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();

      // Necesitamos el usuario ANTES de generar el PDF para poder subirlo a su carpeta en Storage
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('No hay sesión activa.');

      const verificationUrl = `${APP_URL}/verificar/${decaId}`;

      const newDeca: DecaDocument = {
        id: decaId,
        version: 1,
        creationDate: now,
        status: 'EN_TRANSITO',
        carrier: {
          companyName: carrierName,
          cif: carrierCif,
          address: carrierAddress,
          driverName: driverName,
          driverDni: driverDni,
          driverEmail: driverEmail || undefined,
          tractorPlate: tractorPlate,
          trailerPlate: trailerPlate,
          phone: '600000000',
        },
        contractualShipper: {
          companyName: shipperName,
          cif: shipperCif,
          address: shipperAddress,
          contactName: shipperName,
        },
        shipments: [
          {
            id: '1',
            trackingNumber: `TRK-${Math.floor(100 + Math.random() * 900)}`,
            originAddress: origin,
            originCity: origin,
            originPostalCode: '28001',
            destinationAddress: destination,
            destinationCity: destination,
            destinationPostalCode: '08001',
            goodsDescription: goodsDesc,
            goodsCategory: 'General',
            packageCount: parseInt(packageCount) || 1,
            grossWeightKg: parseFloat(grossWeight) || 0,
            shipperName: shipperName,
            consigneeName: destination,
          }
        ],
        route: {
          originMain: origin,
          destinationMain: destination,
          plannedStartDate: new Date(transportDate).toISOString(),
          plannedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
        },
        history: [],
        digitalSignature: `SHA256-DIGITAL-SIGNATURE-${decaId}-${Date.now()}`,
        fileSizeBytes: 0,
        legalRetentionExpiresDate: new Date(Date.now() + 31536000000).toISOString(),
        observations: observations,
        qrUrl: verificationUrl
      };

      const { blob, sizeBytes } = await generateDecaPdf(newDeca, verificationUrl);
      newDeca.fileSizeBytes = sizeBytes;

      // Subimos el fichero real al repositorio (Supabase Storage) — esto es lo que
      // convierte el PDF en un documento almacenado de verdad, no regenerado al vuelo.
      const pdfStoragePath = `${userId}/${decaId}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('decas-pdf')
        .upload(pdfStoragePath, blob, { contentType: 'application/pdf', upsert: true });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('decas').insert([
        {
          id: newDeca.id,
          version: newDeca.version,
          status: newDeca.status,
          carrier: newDeca.carrier,
          contractual_shipper: newDeca.contractualShipper,
          route: newDeca.route,
          shipments: newDeca.shipments,
          digital_signature: newDeca.digitalSignature,
          file_size_bytes: newDeca.fileSizeBytes,
          qr_url: newDeca.qrUrl,
          pdf_storage_path: pdfStoragePath,
          observations: newDeca.observations || null,
          user_id: userId
        }
      ]);

      if (dbError) throw dbError;

      // El conductor debe disponer del DeCA antes del inicio del servicio (apartado Séptimo)
      notifyDriver(
        notifyMethod,
        newDeca.carrier.phone,
        newDeca.carrier.driverEmail,
        `Aquí tienes tu Documento de Control (DeCA) ${newDeca.id}. Debes llevarlo contigo (PDF o QR) antes de iniciar el servicio.`,
        verificationUrl
      );

      router.push('/');

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-6 sm:p-10">
      <div className="max-w-4xl mx-auto w-full">
        
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-semibold mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Tablero
        </button>
        
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Emisión de Documento de Control (Orden FOM/2861/2012)
          </h2>
          <p className="text-slate-500 mt-1">
            Rellene los campos obligatorios correspondientes a la carta de porte y transporte por carretera.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 text-rose-600 p-4 rounded-xl text-sm border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* BLOQUE A: Cargador Contractual */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">A. Cargador Contractual</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre / Denominación Social</label>
                <input type="text" required value={shipperName} onChange={e => setShipperName(e.target.value)} placeholder="Ej. CITRICOS CUELLO SL" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">NIF / CIF</label>
                <input type="text" required value={shipperCif} onChange={e => setShipperCif(e.target.value)} placeholder="Ej. B-30411136" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Dirección y Población</label>
                <input type="text" required value={shipperAddress} onChange={e => setShipperAddress(e.target.value)} placeholder="Ej. C/ ORILLA DE AZARBE 243, 30139 EL RAAL (MURCIA)" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
            </div>
          </div>

          {/* BLOQUE B: Transportista Efectivo */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
              <Truck className="w-5 h-5 text-blue-600" /> B. Transportista Efectivo y Conductor
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Empresa Transportista</label>
                <input type="text" required value={carrierName} onChange={e => setCarrierName(e.target.value)} placeholder="Ej. PEPILLO A. MIGUEL, S.L." className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">CIF Transportista</label>
                <input type="text" required value={carrierCif} onChange={e => setCarrierCif(e.target.value)} placeholder="Ej. B-30463178" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Domicilio Empresa</label>
                <input type="text" required value={carrierAddress} onChange={e => setCarrierAddress(e.target.value)} placeholder="Ej. Ctra. Balsicas, 78, 30730 SAN JAVIER (Murcia)" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Conductor</label>
                <input type="text" required value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Ej. PASCUAL MARTINEZ" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">DNI Conductor</label>
                <input type="text" required value={driverDni} onChange={e => setDriverDni(e.target.value)} placeholder="Ej. 24060486-D" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-600 uppercase">Notificar al conductor la emisión del DeCA</h4>
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
          </div>

          {/* BLOQUE C: Origen y Destino */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">C. Lugar de Origen y Destino del Envío</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lugar de Origen</label>
                <input type="text" required value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Ej. CTRA A-499 SIN, 21590 VILLABLANCA (HUELVA)" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lugar de Destino</label>
                <input type="text" required value={destination} onChange={e => setDestination(e.target.value)} placeholder="Ej. CLICOIN, 30-100 ESPINARDO (MURCIA)" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
            </div>
          </div>

          {/* BLOQUE D: Naturaleza y Peso de la Mercancía */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">D. Naturaleza y Peso de la Mercancía</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción de la Mercancía</label>
                <input type="text" required value={goodsDesc} onChange={e => setGoodsDesc(e.target.value)} placeholder="Ej. NARANJA A GRANEL" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Magnitud / Bultos</label>
                <input type="text" required value={packageCount} onChange={e => setPackageCount(e.target.value)} placeholder="Ej. 24" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Peso Bruto (Kg)</label>
                <input type="text" required value={grossWeight} onChange={e => setGrossWeight(e.target.value)} placeholder="Ej. 420" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
            </div>
          </div>

          {/* BLOQUE E: Fecha de Realización del Transporte */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">E. Fecha de Realización del Transporte</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha del Servicio</label>
                <input type="date" required value={transportDate} onChange={e => setTransportDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
            </div>
          </div>

          {/* BLOQUE F: Matrículas de los Vehículos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">F. Matrícula/s del/os Vehículo/s</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Matrícula Tractor</label>
                <input type="text" required value={tractorPlate} onChange={e => setTractorPlate(e.target.value)} placeholder="Ej. 9121-LNG" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Matrícula Remolque / Semirremolque</label>
                <input type="text" value={trailerPlate} onChange={e => setTrailerPlate(e.target.value)} placeholder="Ej. R-0803-BCN" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
            </div>
          </div>

          {/* BLOQUE G: Observaciones */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">G. Observaciones / Reservas</h3>
            <div>
              <textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Indique cualquier observación o reserva útil..." rows={3} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Generando Documento...' : 'Emitir y Guardar DeCA Oficial'}
          </button>
        </form>
      </div>
    </div>
  );
}