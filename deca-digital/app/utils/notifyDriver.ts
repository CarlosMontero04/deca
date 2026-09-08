// WhatsApp: abre la app/web con el mensaje ya preparado — esto siempre ha
// funcionado bien, no se toca. Email: en vez de depender del navegador
// (mailto:, que fallaba si no había cliente de correo asociado), esto llama
// a una ruta del propio servidor que envía el correo de verdad usando las
// credenciales SMTP de OPERPAL. Ya no depende de nada del dispositivo de
// quien lo pulsa.
//
// IMPORTANTE: llamar a esta función SIEMPRE desde un manejador de clic directo
// (onClick de un botón), nunca automáticamente después de un `await` (como tras
// guardar en Supabase). Los navegadores bloquean silenciosamente los window.open()
// que no vienen de una interacción del usuario justo en ese instante — esto solo
// afecta a la parte de WhatsApp, ya que el email ahora no abre ninguna ventana.

export type NotificationMethod = 'telefono' | 'email';

export async function notifyDriver(
  method: NotificationMethod,
  phone: string | undefined,
  email: string | undefined,
  message: string,
  verificationUrl: string
): Promise<{ success: boolean; error?: string }> {
  const fullMessage = `${message}\n\n${verificationUrl}\n\n— OPERPAL`;

  if (method === 'telefono') {
    if (!phone) return { success: false, error: 'No hay teléfono guardado.' };
    const digits = phone.replace(/\D/g, '');
    // Si son 9 dígitos asumimos número español y anteponemos el prefijo 34.
    // Si ya viene con prefijo internacional (más de 9 dígitos), lo dejamos tal cual.
    const intl = digits.length === 9 ? `34${digits}` : digits;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(fullMessage)}`, '_blank');
    return { success: true };
  }

  if (method === 'email') {
    if (!email) return { success: false, error: 'No hay email guardado.' };
    try {
      const res = await fetch('/api/notify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, subject: 'Tu Documento de Control (DeCA)', text: fullMessage }),
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

  return { success: false, error: 'Método de notificación no reconocido.' };
}

// Respaldo para cuando mailto: no hace nada — esto pasa cuando el navegador
// no tiene ningún cliente de correo asociado por defecto (frecuente si solo
// usas webmail). No hay forma de detectar eso desde código ni de forzar la
// asociación, así que en vez de depender solo de mailto:, esto genera el
// mensaje ya redactado para que la persona lo copie y lo pegue donde quiera.
export function buildEmailFallback(email: string | undefined, message: string, verificationUrl: string) {
  const fullMessage = `${message}\n\n${verificationUrl}\n\n— OPERPAL`;
  return `Para: ${email || '(sin email guardado)'}\nAsunto: Tu Documento de Control (DeCA)\n\n${fullMessage}`;
}
