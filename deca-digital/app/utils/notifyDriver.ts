// Abre WhatsApp o el cliente de correo con el mensaje y el enlace de verificación
// ya preparados, para que quien emite/modifica el DeCA solo tenga que pulsar "Enviar".
// No enviamos nada automáticamente en nombre de nadie: la persona sigue confirmando
// el envío en la app externa (WhatsApp / correo) que se abre.
//
// IMPORTANTE: llamar a esta función SIEMPRE desde un manejador de clic directo
// (onClick de un botón), nunca automáticamente después de un `await` (como tras
// guardar en Supabase). Los navegadores bloquean silenciosamente los window.open()
// que no vienen de una interacción del usuario justo en ese instante.

export type NotificationMethod = 'telefono' | 'email';

export function notifyDriver(
  method: NotificationMethod,
  phone: string | undefined,
  email: string | undefined,
  message: string,
  verificationUrl: string
) {
  const fullMessage = `${message}\n\n${verificationUrl}`;

  if (method === 'telefono') {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    // Si son 9 dígitos asumimos número español y anteponemos el prefijo 34.
    // Si ya viene con prefijo internacional (más de 9 dígitos), lo dejamos tal cual.
    const intl = digits.length === 9 ? `34${digits}` : digits;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(fullMessage)}`, '_blank');
    return true;
  }

  if (method === 'email') {
    if (!email) return false;
    const subject = encodeURIComponent('Tu Documento de Control (DeCA)');
    const body = encodeURIComponent(fullMessage);
    // location.href en vez de window.open: los navegadores bloquean con frecuencia
    // los window.open() disparados después de operaciones async (como guardar en
    // Supabase), tratándolos como popups no solicitados. mailto vía location.href
    // no navega realmente fuera de la página — el sistema operativo intercepta el
    // enlace y abre el cliente de correo — y no lo bloquea ningún popup-blocker.
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    return true;
  }

  return false;
}
