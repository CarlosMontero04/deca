"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { generateDecaPdf } from '@/app/utils/pdfGenerator';
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

export default function VerificarPage() {
  const params = useParams();
  const id = params?.id as string;
  
  const [error, setError] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchAndDownloadPdf = async () => {
      if (!id) return;

      try {
        // 1. Buscamos los datos del DeCA mediante la función segura (nunca acceso directo a la tabla)
        const { data: decaRows, error: dbError } = await supabase
          .rpc('get_deca_for_verification', { p_id: id });

        const deca = decaRows?.[0];

        if (dbError || !deca) {
          setError(true);
          return;
        }

        // 2. Documento nativo digital real: descargamos el PDF tal como quedó
        //    almacenado en el repositorio en el momento de su emisión/modificación
        //    (no lo regeneramos al vuelo, para que la fecha del fichero sea la real).
        if (deca.pdf_storage_path) {
          const { data: publicUrlData } = supabase.storage
            .from('decas-pdf')
            .getPublicUrl(deca.pdf_storage_path);

          const a = document.createElement('a');
          a.href = `${publicUrlData.publicUrl}?v=${deca.version}`;
          a.download = `${deca.id}_Documento_Control.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setDownloaded(true);
          return;
        }

        // Reserva de compatibilidad: documentos antiguos emitidos antes de que
        // existiera el repositorio de Storage. Se regenera al vuelo como antes.
        const decaData = {
          id: deca.id,
          version: deca.version,
          creationDate: deca.creation_date,
          status: deca.status,
          carrier: deca.carrier,
          contractualShipper: deca.contractual_shipper,
          shipments: deca.shipments,
          route: deca.route,
          history: deca.history || [],
          digitalSignature: deca.digital_signature,
          fileSizeBytes: deca.file_size_bytes || 0,
          legalRetentionExpiresDate: deca.legal_retention_expires_date || '',
          qrUrl: deca.qr_url || window.location.href,
          observations: deca.observations || '',
          stops: deca.stops || []
        };
        const { blob } = await generateDecaPdf(decaData, decaData.qrUrl);
        const pdfUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = `${deca.id}_Documento_Control.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
        setDownloaded(true);

      } catch (err) {
        console.error("Error generando el documento:", err);
        setError(true);
      }
    };

    fetchAndDownloadPdf();
  }, [id, supabase]);

  // Pantalla de error si el documento no existe
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-rose-200 p-8 max-w-md w-full text-center shadow-sm">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">Documento No Válido</h1>
          <p className="text-sm text-slate-500">
            El código escaneado no corresponde a ningún Documento de Control activo en el sistema o ha sido revocado.
          </p>
        </div>
      </div>
    );
  }

  // Pantalla de éxito tras la descarga
  if (downloaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
        <h1 className="text-xl font-bold text-slate-800">Descarga Completada</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-sm">
          El documento oficial ha sido descargado en tu dispositivo. Puedes cerrar esta ventana.
        </p>
      </div>
    );
  }

  // Pantalla de transición (carga inicial)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <Loader2 className="w-12 h-12 text-[#2A1670] animate-spin mb-4" />
      <h1 className="text-lg font-bold text-slate-800">Descargando documento oficial...</h1>
      <p className="text-sm text-slate-500 mt-2 max-w-sm">
        Generando archivo PDF nativo mediante descarga directa para inspección.
      </p>
    </div>
  );
}