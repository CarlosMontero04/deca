// Abre WhatsApp o el cliente de correo con el mensaje y el enlace de verificación
// ya preparados, para que quien emite/modifica el DeCA solo tenga que pulsar "Enviar".
// No enviamos nada automáticamente en nombre de nadie: la persona sigue confirmando
// el envío en la app externa (WhatsApp / correo) que se abre.

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
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    return true;
  }

  return false;
}
