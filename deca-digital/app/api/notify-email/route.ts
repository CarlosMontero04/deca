import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@/app/utils/supabase/server';

// Cada persona de OPERPAL tiene su propio correo, así que el mensaje debe
// salir desde la cuenta de quien lo esté enviando, no siempre desde una
// única cuenta compartida. Para saber quién es, identificamos al usuario
// mediante su sesión (la cookie del servidor, no algo que el navegador
// pueda falsear) y elegimos las credenciales SMTP que le correspondan según
// las variables de entorno configuradas en Vercel.
//
// Variables de entorno necesarias, una tanda por persona (SMTP1_*, SMTP2_*...):
//   SMTP1_LOGIN_EMAIL  → el email con el que esa persona inicia sesión en la app
//   SMTP1_HOST, SMTP1_PORT, SMTP1_USER, SMTP1_PASSWORD, SMTP1_FROM (opcional)
// Para añadir una tercera persona en el futuro: añadir SMTP3_* en Vercel y
// una entrada más en el array CREDENCIALES de abajo.

function credencialesDisponibles() {
  const tandas = [];
  for (let i = 1; i <= 5; i++) {
    const loginEmail = process.env[`SMTP${i}_LOGIN_EMAIL`];
    const host = process.env[`SMTP${i}_HOST`];
    if (loginEmail && host) {
      tandas.push({
        loginEmail,
        host,
        port: Number(process.env[`SMTP${i}_PORT`] || 587),
        user: process.env[`SMTP${i}_USER`],
        password: process.env[`SMTP${i}_PASSWORD`],
        from: process.env[`SMTP${i}_FROM`] || process.env[`SMTP${i}_USER`],
      });
    }
  }
  return tandas;
}

export async function POST(req: NextRequest) {
  try {
    const { to, subject, text, attachmentBucket, attachmentPath, attachmentFilename } = await req.json();

    if (!to || !subject || !text) {
      return NextResponse.json({ error: 'Faltan datos para enviar el correo.' }, { status: 400 });
    }

    // Identificamos al usuario conectado a través de su sesión del servidor
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'No hay sesión activa.' }, { status: 401 });
    }

    const credenciales = credencialesDisponibles().find(
      c => c.loginEmail.toLowerCase() === user.email!.toLowerCase()
    );

    if (!credenciales) {
      console.error(`No hay credenciales SMTP configuradas para ${user.email}`);
      return NextResponse.json({ error: 'Tu cuenta no tiene un correo de envío configurado. Contacta con el administrador.' }, { status: 500 });
    }

    // Si se pide adjunto, lo traemos del mismo Storage donde ya vive, usando
    // la sesión del propio usuario — las políticas de seguridad ya existentes
    // garantizan que solo pueda adjuntar sus propios archivos.
    let attachments: { filename: string; content: Buffer }[] | undefined;
    if (attachmentBucket && attachmentPath) {
      const { data: fileData, error: fileError } = await supabase.storage
        .from(attachmentBucket)
        .download(attachmentPath);
      if (fileError || !fileData) {
        return NextResponse.json({ error: 'No se pudo obtener el archivo adjunto.' }, { status: 500 });
      }
      const buffer = Buffer.from(await fileData.arrayBuffer());
      attachments = [{ filename: attachmentFilename || 'documento.pdf', content: buffer }];
    }

    const transporter = nodemailer.createTransport({
      host: credenciales.host,
      port: credenciales.port,
      secure: credenciales.port === 465,
      auth: {
        user: credenciales.user,
        pass: credenciales.password,
      },
    });

    await transporter.sendMail({
      from: `"OPERPAL" <${credenciales.from}>`,
      to,
      // Copia oculta a la propia cuenta que envía — así queda constancia del
      // envío en tu bandeja de entrada, ya que el SMTP en bruto no guarda
      // copia en "Enviados" por sí solo (eso lo hacen los clientes de correo,
      // no el envío directo por SMTP).
      bcc: credenciales.user,
      subject,
      text,
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error enviando email:', err);
    return NextResponse.json({ error: 'No se pudo enviar el correo. Revisa las credenciales SMTP.' }, { status: 500 });
  }
}
