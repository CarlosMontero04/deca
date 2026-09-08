import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Envía el correo desde el servidor, usando las credenciales SMTP del hosting
// de OPERPAL (configuradas como variables de entorno en Vercel, nunca en el
// código). Esto sustituye al mailto: del navegador, que dependía de que el
// dispositivo tuviera un cliente de correo asociado — aquí ya no depende de
// eso: el envío ocurre en el servidor, no en el navegador de quien lo pulsa.
export async function POST(req: NextRequest) {
  try {
    const { to, subject, text } = await req.json();

    if (!to || !subject || !text) {
      return NextResponse.json({ error: 'Faltan datos para enviar el correo.' }, { status: 400 });
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error('Faltan variables de entorno SMTP_HOST / SMTP_USER / SMTP_PASSWORD');
      return NextResponse.json({ error: 'El envío de correo no está configurado en el servidor.' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"OPERPAL" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error enviando email:', err);
    return NextResponse.json({ error: 'No se pudo enviar el correo. Revisa las credenciales SMTP.' }, { status: 500 });
  }
}
