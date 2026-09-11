"use client";

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ArrowLeft, Save, Truck } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import { generateDecaPdf } from '../utils/pdfGenerator';
import { notifyDriver, NotificationMethod, buildEmailFallback } from '../utils/notifyDriver';
import { generateDecaId } from '../utils/generateDecaId';
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
  const [shipperPhone, setShipperPhone] = useState('');
  const [shipperEmail, setShipperEmail] = useState('');

  // Bloque B: Transportista Efectivo
  const [carrierName, setCarrierName] = useState('');
  const [carrierCif, setCarrierCif] = useState('');
  const [carrierAddress, setCarrierAddress] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverDni, setDriverDni] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  const [carrierPhone, setCarrierPhone] = useState('');
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
  const [trailerPlate2, setTrailerPlate2] = useState('');

  // Bloque G: Observaciones
  const [observations, setObservations] = useState('');

  // Solo para tu gestión interna — no forma parte del documento legal
  const [internalTitle, setInternalTitle] = useState('');

  // Paradas intermedias (opcional, una por línea)
  const [stopsText, setStopsText] = useState('');

  // Hace que una caja de texto crezca sola según el contenido, en vez de
  // quedarse con una altura fija y barra de scroll — igual que en Órdenes de Carga.
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

  const internalTitleRef = useRef<HTMLTextAreaElement>(null);
  const shipperNameRef = useRef<HTMLTextAreaElement>(null);
  const shipperCifRef = useRef<HTMLTextAreaElement>(null);
  const shipperAddressRef = useRef<HTMLTextAreaElement>(null);
  const shipperPhoneRef = useRef<HTMLTextAreaElement>(null);
  const shipperEmailRef = useRef<HTMLTextAreaElement>(null);
  const carrierNameRef = useRef<HTMLTextAreaElement>(null);
  const carrierCifRef = useRef<HTMLTextAreaElement>(null);
  const carrierAddressRef = useRef<HTMLTextAreaElement>(null);
  const driverNameRef = useRef<HTMLTextAreaElement>(null);
  const driverDniRef = useRef<HTMLTextAreaElement>(null);
  const driverEmailRef = useRef<HTMLTextAreaElement>(null);
  const carrierPhoneRef = useRef<HTMLTextAreaElement>(null);
  const originRef = useRef<HTMLTextAreaElement>(null);
  const destinationRef = useRef<HTMLTextAreaElement>(null);
  const goodsDescRef = useRef<HTMLTextAreaElement>(null);
  const packageCountRef = useRef<HTMLTextAreaElement>(null);
  const grossWeightRef = useRef<HTMLTextAreaElement>(null);
  const tractorPlateRef = useRef<HTMLTextAreaElement>(null);
  const trailerPlateRef = useRef<HTMLTextAreaElement>(null);
  const trailerPlate2Ref = useRef<HTMLTextAreaElement>(null);
  const stopsTextRef = useRef<HTMLTextAreaElement>(null);
  const observationsRef = useRef<HTMLTextAreaElement>(null);

  // Se ejecuta ante CUALQUIER cambio de estos valores — al escribir o al
  // rellenarse solo desde un desplegable de flota — así todas las cajas se
  // ajustan siempre, no solo cuando escribes directamente.
  useLayoutEffect(() => {
    [internalTitleRef, shipperNameRef, shipperCifRef, shipperAddressRef, shipperPhoneRef, shipperEmailRef,
     carrierNameRef, carrierCifRef, carrierAddressRef, driverNameRef, driverDniRef, driverEmailRef, carrierPhoneRef,
     originRef, destinationRef, goodsDescRef, packageCountRef, grossWeightRef,
     tractorPlateRef, trailerPlateRef, trailerPlate2Ref, stopsTextRef, observationsRef].forEach(r => resizeEl(r.current));
  }, [internalTitle, shipperName, shipperCif, shipperAddress, shipperPhone, shipperEmail,
      carrierName, carrierCif, carrierAddress, driverName, driverDni, driverEmail, carrierPhone,
      origin, destination, goodsDesc, packageCount, grossWeight,
      tractorPlate, trailerPlate, trailerPlate2, stopsText, observations]);



  // Tras guardar con éxito, guardamos aquí lo necesario para notificar al conductor
  // mediante un clic explícito (ver por qué en notifyDriver.ts)
  const [createdInfo, setCreatedInfo] = useState<{
    id: string; verificationUrl: string; phone: string; email?: string; method: NotificationMethod;
  } | null>(null);

  // Flota guardada (panel /flota), para autorellenar en vez de escribir todo a mano
  const [savedCarriers, setSavedCarriers] = useState<any[]>([]);
  const [savedDrivers, setSavedDrivers] = useState<any[]>([]);
  const [savedTractors, setSavedTractors] = useState<any[]>([]);
  const [savedTrailers, setSavedTrailers] = useState<any[]>([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [fleetSaveMessage, setFleetSaveMessage] = useState('');
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ success: boolean; error?: string } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const loadFleet = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;
      const [c, d, t, tr, company] = await Promise.all([
        supabase.from('carriers').select('*').order('company_name'),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('tractors').select('*').order('tractor_plate'),
        supabase.from('trailers').select('*').order('trailer_plate'),
        supabase.from('company_profile').select('*').eq('user_id', uid).maybeSingle(),
      ]);
      setSavedCarriers(c.data || []);
      setSavedDrivers(d.data || []);
      setSavedTractors(t.data || []);
      setSavedTrailers(tr.data || []);
      // OPERPAL es siempre el Cargador Contractual (art. 4 Orden FOM/2861/2012):
      // se precarga solo, pero sigue siendo editable por si hiciera falta.
      if (company.data) {
        setShipperName(company.data.company_name || '');
        setShipperCif(company.data.cif || '');
        setShipperAddress(company.data.address || '');
        setShipperPhone(company.data.phone || '');
        setShipperEmail(company.data.email || '');
      }
    };
    loadFleet();
  }, []);

  const handleSelectCarrier = (carrierId: string) => {
    setSelectedCarrierId(carrierId);
    const c = savedCarriers.find(c => c.id === carrierId);
    if (c) {
      setCarrierName(c.company_name);
      setCarrierCif(c.cif);
      setCarrierAddress(c.address || '');
      setCarrierPhone(c.phone || '');
    }
  };

  const handleSelectDriver = (driverId: string) => {
    const d = savedDrivers.find(d => d.id === driverId);
    if (d) {
      setDriverName(d.name);
      setDriverDni(d.dni || '');
      setDriverEmail(d.email || '');
      if (d.phone) setCarrierPhone(d.phone);
    }
  };

  const handleSelectTractor = (tractorId: string) => {
    const t = savedTractors.find(t => t.id === tractorId);
    if (t) {
      setTractorPlate(t.tractor_plate);
    }
  };

  const handleSelectTrailer = (trailerId: string) => {
    const t = savedTrailers.find(t => t.id === trailerId);
    if (t) {
      setTrailerPlate(t.trailer_plate);
    }
  };

  const handleSelectTrailer2 = (trailerId: string) => {
    const t = savedTrailers.find(t => t.id === trailerId);
    if (t) {
      setTrailerPlate2(t.trailer_plate);
    }
  };

  const flashFleetMessage = (msg: string) => {
    setFleetSaveMessage(msg);
    setTimeout(() => setFleetSaveMessage(''), 3000);
  };

  const refreshFleet = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const uid = session.user.id;
    const [c, d, t, tr] = await Promise.all([
      supabase.from('carriers').select('*').order('company_name'),
      supabase.from('drivers').select('*').order('name'),
      supabase.from('tractors').select('*').order('tractor_plate'),
      supabase.from('trailers').select('*').order('trailer_plate'),
    ]);
    setSavedCarriers(c.data || []);
    setSavedDrivers(d.data || []);
    setSavedTractors(t.data || []);
    setSavedTrailers(tr.data || []);
  };

  const saveCarrierToFleet = async () => {
    if (!carrierName || !carrierCif) { flashFleetMessage('Rellena empresa y CIF primero'); return; }
    const yaExiste = savedCarriers.some(c => c.cif.toLowerCase() === carrierCif.toLowerCase());
    if (yaExiste) { flashFleetMessage('Ya estaba guardado'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('carriers').insert([{
      company_name: carrierName, cif: carrierCif, address: carrierAddress, phone: carrierPhone, user_id: session.user.id
    }]);
    await refreshFleet();
    flashFleetMessage('✓ Transportista guardado');
  };

  const saveDriverToFleet = async () => {
    if (!driverName) { flashFleetMessage('Rellena el nombre primero'); return; }
    const yaExiste = savedDrivers.some(d => driverDni && d.dni?.toLowerCase() === driverDni.toLowerCase());
    if (yaExiste) { flashFleetMessage('Ya estaba guardado'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('drivers').insert([{
      name: driverName, dni: driverDni, email: driverEmail || null, phone: carrierPhone,
      carrier_id: selectedCarrierId || null, user_id: session.user.id
    }]);
    await refreshFleet();
    flashFleetMessage('✓ Conductor guardado');
  };

  const saveTractorToFleet = async () => {
    if (!tractorPlate) { flashFleetMessage('Rellena la matrícula primero'); return; }
    const yaExiste = savedTractors.some(t => t.tractor_plate.toLowerCase() === tractorPlate.toLowerCase());
    if (yaExiste) { flashFleetMessage('Ya estaba guardada'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('tractors').insert([{
      tractor_plate: tractorPlate,
      carrier_id: selectedCarrierId || null, user_id: session.user.id
    }]);
    await refreshFleet();
    flashFleetMessage('✓ Tractora guardada');
  };

  const saveTrailerPlateToFleet = async (plate: string) => {
    if (!plate) { flashFleetMessage('Rellena la matrícula del remolque primero'); return; }
    const yaExiste = savedTrailers.some(t => t.trailer_plate.toLowerCase() === plate.toLowerCase());
    if (yaExiste) { flashFleetMessage('Ya estaba guardado'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('trailers').insert([{
      trailer_plate: plate,
      carrier_id: selectedCarrierId || null, user_id: session.user.id
    }]);
    await refreshFleet();
    flashFleetMessage('✓ Remolque guardado');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (transportDate && transportDate < new Date().toISOString().slice(0, 10)) {
      const confirmar = confirm('La fecha de transporte ya ha pasado. La norma exige generar el DeCA antes de iniciar el servicio; emitirlo con fecha pasada puede ser sancionable. ¿Seguro que quieres continuar?');
      if (!confirmar) return;
    }

    setLoading(true);
    setError(null);

    try {
      const decaId = generateDecaId();
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
          trailerPlate2: trailerPlate2 || undefined,
          phone: carrierPhone,
        },
        contractualShipper: {
          companyName: shipperName,
          cif: shipperCif,
          address: shipperAddress,
          contactName: shipperName,
          phone: shipperPhone || undefined,
          email: shipperEmail || undefined,
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
            packageCount: packageCount,
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
        internalTitle: internalTitle || undefined,
        stops: stopsText.split('\n').map(s => s.trim()).filter(Boolean),
        qrUrl: verificationUrl
      };

      const { blob, sizeBytes } = await generateDecaPdf(newDeca, verificationUrl);
      newDeca.fileSizeBytes = sizeBytes;

      // La Resolución exige que el PDF no supere los 5 MB (Segundo.1)
      const MAX_PDF_BYTES = 5 * 1024 * 1024;
      if (sizeBytes > MAX_PDF_BYTES) {
        throw new Error(`El PDF generado pesa ${(sizeBytes / 1024 / 1024).toFixed(2)} MB, por encima del límite legal de 5 MB. Reduce el número de envíos u observaciones e inténtalo de nuevo.`);
      }

      // Subimos el fichero real al repositorio (Supabase Storage) — esto es lo que
      // convierte el PDF en un documento almacenado de verdad, no regenerado al vuelo.
      const pdfStoragePath = `${userId}/${decaId}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('decas-pdf')
        .upload(pdfStoragePath, blob, { contentType: 'application/pdf', upsert: true, cacheControl: '0' });

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
          internal_title: newDeca.internalTitle || null,
          stops: newDeca.stops || [],
          legal_retention_expires_date: newDeca.legalRetentionExpiresDate,
          user_id: userId
        }
      ]);

      if (dbError) throw dbError;

      // No notificamos aquí automáticamente: los navegadores bloquean en silencio
      // los window.open()/mailto disparados después de un await (como este insert).
      // Guardamos lo necesario y mostramos un botón explícito en pantalla.
      setCreatedInfo({
        id: newDeca.id,
        verificationUrl,
        phone: newDeca.carrier.phone,
        email: newDeca.carrier.driverEmail,
        method: notifyMethod
      });
      setLoading(false);

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-6 sm:p-10">
      <div className="max-w-4xl mx-auto w-full">
        
        <button 
          onClick={() => router.push('/deca')}
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

        {createdInfo ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6 text-center">
            <div className="text-emerald-600 text-lg font-bold">✅ DeCA {createdInfo.id} emitido correctamente</div>
            <p className="text-sm text-slate-500">
              El conductor debe disponer de este documento antes de iniciar el servicio. Pulsa el botón para {createdInfo.method === 'telefono' ? 'abrir WhatsApp' : 'enviarle el correo'} con el mensaje ya preparado.
            </p>
            <button
              type="button"
              disabled={notifySending}
              onClick={async () => {
                setNotifySending(true);
                setNotifyResult(null);
                const result = await notifyDriver(createdInfo.method, createdInfo.phone, createdInfo.email,
                  `Aquí tienes tu Documento de Control (DeCA) ${createdInfo.id}. Debes llevarlo contigo (PDF o QR) antes de iniciar el servicio.`,
                  createdInfo.verificationUrl);
                setNotifySending(false);
                setNotifyResult(result);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition disabled:opacity-50"
            >
              {notifySending ? 'Enviando...' : `Notificar al conductor ${createdInfo.method === 'telefono' ? 'por WhatsApp' : 'por Email'}`}
            </button>
            {notifyResult?.success && (
              <p className="text-sm text-emerald-600 font-semibold">✓ {createdInfo.method === 'email' ? 'Correo enviado' : 'WhatsApp abierto'}</p>
            )}
            {notifyResult && !notifyResult.success && (
              <p className="text-sm text-rose-600 font-semibold">✗ {notifyResult.error}</p>
            )}
            {createdInfo.method === 'email' && (!notifyResult || !notifyResult.success) && (
              <div className="text-left">
                <p className="text-xs text-slate-400 mb-1">Si el envío falla, copia este mensaje y pégalo donde quieras:</p>
                <textarea
                  readOnly
                  value={buildEmailFallback(createdInfo.email, `Aquí tienes tu Documento de Control (DeCA) ${createdInfo.id}. Debes llevarlo contigo (PDF o QR) antes de iniciar el servicio.`, createdInfo.verificationUrl)}
                  rows={5}
                  className="w-full px-3 py-2 border rounded-lg text-xs text-slate-700 bg-slate-50 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(buildEmailFallback(createdInfo.email, `Aquí tienes tu Documento de Control (DeCA) ${createdInfo.id}. Debes llevarlo contigo (PDF o QR) antes de iniciar el servicio.`, createdInfo.verificationUrl));
                    setCopiedMessage(true);
                    setTimeout(() => setCopiedMessage(false), 2000);
                  }}
                  className="mt-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg"
                >
                  {copiedMessage ? '✓ Copiado' : 'Copiar mensaje'}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => router.push('/deca')}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
            >
              Ir al Tablero
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Título interno: solo para tu gestión, no forma parte del documento legal */}
          <div className="bg-slate-100 rounded-2xl border border-slate-200 p-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Título Interno (opcional)</label>
              <textarea ref={internalTitleRef} value={internalTitle} onChange={e => { setInternalTitle(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. Envío Mercadona semana 36" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
          </div>

          {/* BLOQUE A: Cargador Contractual */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-800">A. Cargador Contractual</h3>
              <a href="/flota" className="text-xs font-semibold text-blue-600 hover:text-blue-700">Editar datos de OPERPAL →</a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre / Denominación Social</label>
                <textarea ref={shipperNameRef} required value={shipperName} onChange={e => { setShipperName(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. CITRICOS CUELLO SL" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">NIF / CIF</label>
                <textarea ref={shipperCifRef} required value={shipperCif} onChange={e => { setShipperCif(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. B-30411136" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Dirección y Población</label>
                <textarea ref={shipperAddressRef} required value={shipperAddress} onChange={e => { setShipperAddress(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. C/ ORILLA DE AZARBE 243, 30139 EL RAAL (MURCIA)" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
                <textarea ref={shipperPhoneRef} inputMode="tel" value={shipperPhone} onChange={e => { setShipperPhone(e.target.value); autoResize(e); }} rows={1} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <textarea ref={shipperEmailRef} inputMode="email" value={shipperEmail} onChange={e => { setShipperEmail(e.target.value); autoResize(e); }} rows={1} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
            </div>
          </div>

          {/* BLOQUE B: Transportista Efectivo */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
              <Truck className="w-5 h-5 text-blue-600" /> B. Transportista Efectivo y Conductor
            </h3>

            {(savedCarriers.length > 0 || savedDrivers.length > 0) && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedCarriers.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-blue-800 mb-1">Rellenar desde transportista guardado</label>
                    <select value={selectedCarrierId} onChange={e => handleSelectCarrier(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
                      <option value="">-- Escribir a mano --</option>
                      {savedCarriers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                    </select>
                  </div>
                )}
                {savedDrivers.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-blue-800 mb-1">Rellenar desde conductor guardado</label>
                    <select defaultValue="" onChange={e => handleSelectDriver(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
                      <option value="">-- Escribir a mano --</option>
                      {selectedCarrierId && savedDrivers.some(d => d.carrier_id === selectedCarrierId) && (
                        <optgroup label="Vinculados a este transportista">
                          {savedDrivers.filter(d => d.carrier_id === selectedCarrierId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </optgroup>
                      )}
                      <optgroup label="Todos los conductores">
                        {savedDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </optgroup>
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Empresa Transportista</label>
                <textarea ref={carrierNameRef} required value={carrierName} onChange={e => { setCarrierName(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. PEPILLO A. MIGUEL, S.L." className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">CIF Transportista</label>
                <textarea ref={carrierCifRef} required value={carrierCif} onChange={e => { setCarrierCif(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. B-30463178" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Domicilio Empresa</label>
                <textarea ref={carrierAddressRef} required value={carrierAddress} onChange={e => { setCarrierAddress(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. Ctra. Balsicas, 78, 30730 SAN JAVIER (Murcia)" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Conductor</label>
                <textarea ref={driverNameRef} required value={driverName} onChange={e => { setDriverName(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. PASCUAL MARTINEZ" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">DNI Conductor</label>
                <textarea ref={driverDniRef} required value={driverDni} onChange={e => { setDriverDni(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. 24060486-D" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email Conductor</label>
                <textarea ref={driverEmailRef} inputMode="email" value={driverEmail} onChange={e => { setDriverEmail(e.target.value); autoResize(e); }} rows={1} placeholder="conductor@ejemplo.com" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono de Contacto</label>
                <textarea ref={carrierPhoneRef} required inputMode="tel" value={carrierPhone} onChange={e => { setCarrierPhone(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. 600123456" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveCarrierToFleet} className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Guardar transportista en mi flota
              </button>
              <button type="button" onClick={saveDriverToFleet} className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Guardar conductor en mi flota
              </button>
              {fleetSaveMessage && <span className="text-xs text-emerald-600 font-semibold self-center">{fleetSaveMessage}</span>}
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
            </div>
          </div>

          {/* BLOQUE C: Origen y Destino */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">C. Lugar de Origen y Destino del Envío</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lugar de Origen</label>
                <textarea ref={originRef} required value={origin} onChange={e => { setOrigin(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. CTRA A-499 SIN, 21590 VILLABLANCA (HUELVA)" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lugar de Destino</label>
                <textarea ref={destinationRef} required value={destination} onChange={e => { setDestination(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. CLICOIN, 30-100 ESPINARDO (MURCIA)" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Paradas Intermedias (opcional, una por línea)</label>
                <textarea ref={stopsTextRef} value={stopsText} onChange={e => { setStopsText(e.target.value); autoResize(e); }} rows={2} placeholder={"Ej.\nÁrea de servicio Despeñaperros\nAlmacén de tránsito Bailén"} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 resize-none overflow-hidden" />
              </div>
            </div>
          </div>

          {/* BLOQUE D: Naturaleza y Peso de la Mercancía */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">D. Naturaleza y Peso de la Mercancía</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción de la Mercancía</label>
                <textarea ref={goodsDescRef} required value={goodsDesc} onChange={e => { setGoodsDesc(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. NARANJA A GRANEL" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Magnitud / Bultos</label>
                <textarea ref={packageCountRef} required value={packageCount} onChange={e => { setPackageCount(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. 24 palets" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Peso Bruto (Kg)</label>
                <textarea ref={grossWeightRef} required value={grossWeight} onChange={e => { setGrossWeight(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. 420" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
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
            {transportDate && transportDate < new Date().toISOString().slice(0, 10) && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Esta fecha ya ha pasado. La norma exige que el DeCA exista antes de iniciar el servicio — emitirlo con fecha pasada puede considerarse infracción sancionable.
              </p>
            )}
          </div>

          {/* BLOQUE F: Matrículas de los Vehículos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">F. Matrícula/s del/os Vehículo/s</h3>

            {(savedTractors.length > 0 || savedTrailers.length > 0) && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedTractors.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-blue-800 mb-1">Rellenar desde tractora guardada</label>
                    <select defaultValue="" onChange={e => handleSelectTractor(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
                      <option value="">-- Escribir a mano --</option>
                      {selectedCarrierId && savedTractors.some(t => t.carrier_id === selectedCarrierId) && (
                        <optgroup label="Vinculadas a este transportista">
                          {savedTractors.filter(t => t.carrier_id === selectedCarrierId).map(t => <option key={t.id} value={t.id}>{t.tractor_plate}</option>)}
                        </optgroup>
                      )}
                      <optgroup label="Todas las tractoras">
                        {savedTractors.map(t => <option key={t.id} value={t.id}>{t.tractor_plate}</option>)}
                      </optgroup>
                    </select>
                  </div>
                )}
                {savedTrailers.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-blue-800 mb-1">Rellenar desde remolque guardado</label>
                    <select defaultValue="" onChange={e => handleSelectTrailer(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
                      <option value="">-- Escribir a mano --</option>
                      {selectedCarrierId && savedTrailers.some(t => t.carrier_id === selectedCarrierId) && (
                        <optgroup label="Vinculados a este transportista">
                          {savedTrailers.filter(t => t.carrier_id === selectedCarrierId).map(t => <option key={t.id} value={t.id}>{t.trailer_plate}</option>)}
                        </optgroup>
                      )}
                      <optgroup label="Todos los remolques">
                        {savedTrailers.map(t => <option key={t.id} value={t.id}>{t.trailer_plate}</option>)}
                      </optgroup>
                    </select>
                  </div>
                )}
                {savedTrailers.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-blue-800 mb-1">Rellenar 2º remolque desde guardado (opcional)</label>
                    <select defaultValue="" onChange={e => handleSelectTrailer2(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900">
                      <option value="">-- Escribir a mano --</option>
                      {selectedCarrierId && savedTrailers.some(t => t.carrier_id === selectedCarrierId) && (
                        <optgroup label="Vinculados a este transportista">
                          {savedTrailers.filter(t => t.carrier_id === selectedCarrierId).map(t => <option key={t.id} value={t.id}>{t.trailer_plate}</option>)}
                        </optgroup>
                      )}
                      <optgroup label="Todos los remolques">
                        {savedTrailers.map(t => <option key={t.id} value={t.id}>{t.trailer_plate}</option>)}
                      </optgroup>
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Matrícula Tractor</label>
                <textarea ref={tractorPlateRef} required value={tractorPlate} onChange={e => { setTractorPlate(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. 9121-LNG" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Matrícula Remolque / Semirremolque</label>
                <textarea ref={trailerPlateRef} value={trailerPlate} onChange={e => { setTrailerPlate(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. R-0803-BCN" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">2º Remolque (opcional, tren de carretera)</label>
                <textarea ref={trailerPlate2Ref} value={trailerPlate2} onChange={e => { setTrailerPlate2(e.target.value); autoResize(e); }} rows={1} placeholder="Ej. R-1234-XYZ" className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveTractorToFleet} className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Guardar tractora en mi flota
              </button>
              <button type="button" onClick={() => saveTrailerPlateToFleet(trailerPlate)} className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Guardar remolque en mi flota
              </button>
              {trailerPlate2 && (
                <button type="button" onClick={() => saveTrailerPlateToFleet(trailerPlate2)} className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Guardar 2º remolque en mi flota
                </button>
              )}
              {fleetSaveMessage && <span className="text-xs text-emerald-600 font-semibold self-center">{fleetSaveMessage}</span>}
            </div>
          </div>

          {/* BLOQUE G: Observaciones */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">G. Observaciones / Reservas</h3>
            <div>
              <textarea ref={observationsRef} value={observations} onChange={e => { setObservations(e.target.value); autoResize(e); }} placeholder="Indique cualquier observación o reserva útil..." rows={3} className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 resize-none overflow-hidden" />
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
        )}
      </div>
    </div>
  );
}