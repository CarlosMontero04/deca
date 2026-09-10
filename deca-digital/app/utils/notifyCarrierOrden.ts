import { SupabaseClient } from '@supabase/supabase-js';

export type NotifyMethod = 'telefono' | 'email';

// A diferencia del DeCA (donde WhatsApp/email solo llevan un enlace), aquí:
// - Email: el PDF va como adjunto real (la ruta del servidor lo añade).
// - WhatsApp: no se pueden adjuntar archivos por wa.me, así que generamos un
//   enlace temporal de descarga (7 días) — el bucket es privado porque la
//   orden lleva el precio pactado, así que el enlace no debe quedar accesible
//   para siempre como si fuera el QR público del DeCA.
export async function notifyCarrierOrden(
  supabase: SupabaseClient,
  method: NotifyMethod,
  phone: string | undefined,
  email: string | undefined,
  ordenId: string,
  pdfStoragePath: string,
  mensaje: string
): Promise<{ success: boolean; error?: string }> {
  if (method === 'telefono') {
    if (!phone) return { success: false, error: 'No hay teléfono guardado en esta orden.' };
    const { data, error } = await supabase.storage
      .from('ordenes-carga-pdf')
      .createSignedUrl(pdfStoragePath, 60 * 60 * 24 * 7); // 7 días
    if (error || !data) return { success: false, error: 'No se pudo generar el enlace del PDF.' };

    const digits = phone.replace(/\D/g, '');
    const intl = digits.length === 9 ? `34${digits}` : digits;
    const texto = `${mensaje}\n\n${data.signedUrl}\n\n— OPERPAL`;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(texto)}`, '_blank');
    return { success: true };
  }

  if (method === 'email') {
    if (!email) return { success: false, error: 'No hay email guardado en esta orden.' };
    try {
      const res = await fetch('/api/notify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `Orden de Carga ${ordenId} — OPERPAL`,
          text: `${mensaje}\n\n— OPERPAL`,
          attachmentBucket: 'ordenes-carga-pdf',
          attachmentPath: pdfStoragePath,
          attachmentFilename: `${ordenId}.pdf`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'No se pudo enviar el correo.' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'No se pudo conectar con el servidor para enviar el correo.' };
    }
  }

  return { success: false, error: 'Método no reconocido.' };
}
