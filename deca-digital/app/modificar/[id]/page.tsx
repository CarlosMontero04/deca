"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { FileEdit, ArrowLeft, Save, AlertTriangle } from 'lucide-react';
import { generateDecaPdf } from '@/app/utils/pdfGenerator';

export default function ModificarDeca() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const [deca, setDeca] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Campos para el historial
  const [motivo, setMotivo] = useState('CAMBIO_VEHICULO');
  const [detalle, setDetalle] = useState('');
  
  const supabase = createClient();

  useEffect(() => {
    const fetchDeca = async () => {
      const { data, error } = await supabase.from('decas').select('*').eq('id', id).single();
      if (data) setDeca(data);
      setLoading(false);
    };
    fetchDeca();
  }, [id, supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const nuevaVersion = deca.version + 1;
      const { data: { session } } = await supabase.auth.getSession();
      
      const nuevoHistorial = [
        ...(deca.history || []),
        {
          version: nuevaVersion,
          timestamp: new Date().toISOString(),
          reason: motivo,
          details: detalle,
          modifiedBy: session?.user?.user_metadata?.full_name || 'Transportista',
          qrHash: `HASH-MOD-${id}-${Date.now().toString().slice(-6)}`
        }
      ];

      // Reconstruimos el objeto para el PDF
      const decaData = {
        id: deca.id,
        version: nuevaVersion,
        creationDate: deca.creation_date,
        status: deca.status,
        carrier: deca.carrier,
        contractualShipper: deca.contractual_shipper,
        shipments: deca.shipments,
        route: deca.route,
        history: nuevoHistorial,
        digitalSignature: deca.digital_signature,
        fileSizeBytes: deca.file_size_bytes || 0,
        legalRetentionExpiresDate: deca.legal_retention_expires_date || '',
        qrUrl: deca.qr_url,
       observations: deca.observations || ''
      };

      // Regeneramos el PDF para actualizar su tamaño interno con el nuevo historial
      const { blob, sizeBytes } = await generateDecaPdf(decaData, decaData.qrUrl);

      if (deca.pdf_storage_path) {
        const { error: uploadError } = await supabase.storage
        .from('decas-pdf')
        .upload(deca.pdf_storage_path, blob, { contentType: 'application/pdf', upsert: true });
        if (uploadError) throw uploadError;
      }

      // Actualizamos en Supabase
      const { error } = await supabase
        .from('decas')
        .update({
          version: nuevaVersion,
          history: nuevoHistorial,
          file_size_bytes: sizeBytes
        })
        .eq('id', id);

      if (error) throw error;
      router.push('/');

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
            Anotar Modificación en Ruta
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Según el BOE, las modificaciones en ruta (ej. averías, cambios de conductor) deben registrarse digitalmente para generar una nueva versión válida del PDF.
          </p>
          <div className="mt-4 inline-block bg-slate-100 px-3 py-1 rounded font-mono text-sm font-bold text-slate-700">
            Editando ID: {deca.id} (Versión actual: v{deca.version}.0)
          </div>
        </div>

        <form onSubmit={handleUpdate} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-800 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>Al guardar, el documento pasará a la <strong>versión v{deca.version + 1}.0</strong>. El código QR seguirá siendo el mismo y el PDF se actualizará automáticamente con esta incidencia.</p>
          </div>

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
              <option value="OTRO">Otro motivo regulado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Detalle (Sustituye a la anotación manuscrita)</label>
            <textarea 
              required 
              value={detalle} 
              onChange={e => setDetalle(e.target.value)} 
              rows={4} 
              placeholder="Ej. El camión averió en el km 120. Se transborda la carga al remolque R-9999-XYZ..." 
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400" 
            />
          </div>

          <button type="submit" disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl shadow transition flex items-center justify-center gap-2">
            <Save className="w-5 h-5" />
            {saving ? 'Registrando y Firmando...' : 'Firmar Modificación Legal'}
          </button>
        </form>
      </div>
    </div>
  );
}