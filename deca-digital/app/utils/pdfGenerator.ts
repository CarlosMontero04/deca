import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { DecaDocument } from '../types';
import { OPERPAL_LOGO_BASE64, OPERPAL_LOGO_WIDTH_PX, OPERPAL_LOGO_HEIGHT_PX } from './logoBase64';

// Paleta corporativa OPERPAL
const NAVY: [number, number, number] = [42, 22, 112];
const ORANGE: [number, number, number] = [233, 136, 55];
const GRAY_DARK: [number, number, number] = [45, 45, 45];
const GRAY_MUTED: [number, number, number] = [120, 120, 120];
const GRAY_BG: [number, number, number] = [246, 244, 251];

export async function generateDecaPdf(deca: DecaDocument, verificationUrl: string) {
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 300,
    color: { dark: '#2A1670', light: '#FFFFFF' },
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  const sectionHeader = (text: string, y: number) => {
    doc.setFillColor(...NAVY);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(text, margin + 3, y + 4.2);
    return y + 10;
  };

  // Trunca un texto al ancho real disponible (en mm), midiendo con la fuente
  // actual, en vez de adivinar un número fijo de caracteres — así nunca se
  // pisa con la columna siguiente, sea cual sea el idioma o la fuente.
  const truncateToWidth = (text: string, maxWidth: number) => {
    if (doc.getTextWidth(text) <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 1 && doc.getTextWidth(truncated + '...') > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated.trimEnd() + '...';
  };

  const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-ES');
  const fechaLarga = (iso: string) => new Date(iso).toLocaleString('es-ES');

  // --- CABECERA ---
  const logoWidth = 42;
  const logoHeight = logoWidth * (OPERPAL_LOGO_HEIGHT_PX / OPERPAL_LOGO_WIDTH_PX);
  doc.addImage(OPERPAL_LOGO_BASE64, 'PNG', margin, 8, logoWidth, logoHeight);

  const titleX = margin + logoWidth + 6;
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DOCUMENTO ELECTRÓNICO DE CONTROL', titleX, 14);
  doc.text('ADMINISTRATIVO (DeCA)', titleX, 20);

  doc.setTextColor(...GRAY_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Nº ${deca.id}  ·  Versión v${deca.version}.0  ·  Estado: ${deca.status}`, titleX, 26);
  doc.text('Documento nativo digital válido sin firma manuscrita (Orden FOM/2861/2012).', titleX, 30.5);

  // QR arriba a la derecha
  const qrSize = 24;
  doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - qrSize, 6, qrSize, qrSize);
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY_MUTED);
  doc.text('Verificación', pageWidth - margin - qrSize / 2, 6 + qrSize + 3, { align: 'center' });

  // Franja naranja divisoria
  let y = Math.max(8 + logoHeight, 34) + 4;
  doc.setFillColor(...ORANGE);
  doc.rect(0, y, pageWidth, 1.4, 'F');
  y += 8;

  // --- 1. CARGADOR CONTRACTUAL ---
  y = sectionHeader('1. CARGADOR CONTRACTUAL (EMPRESA CONTRATANTE)', y);

  doc.setTextColor(...GRAY_DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Empresa: ${deca.contractualShipper.companyName}  |  NIF/CIF: ${deca.contractualShipper.cif}`, margin, y);
  y += 4.5;
  doc.text(`Contacto/Resp: ${deca.contractualShipper.contactName}`, margin, y);
  y += 4.5;
  doc.text(`Teléfono: ${deca.contractualShipper.phone || 'N/A'}  |  Email: ${deca.contractualShipper.email || 'N/A'}`, margin, y);
  y += 4.5;
  doc.text(`Domicilio: ${deca.contractualShipper.address}`, margin, y);
  y += 4.5;
  // Origen/destino se leen siempre de shipments[0] — la misma fuente que usa la
  // tabla de la sección 3 — para que las dos secciones del PDF nunca puedan
  // mostrarse contradictorias entre sí, aunque algún día route y shipments
  // llegaran a desincronizarse en la base de datos. route.originMain/
  // destinationMain quedan solo como respaldo por si un documento antiguo no
  // tuviera envíos cargados.
  const origenPrincipal = deca.shipments?.[0]?.originAddress || deca.route.originMain;
  const destinoPrincipal = deca.shipments?.[0]?.destinationAddress || deca.route.destinationMain;
  doc.text(`Origen Principal: ${origenPrincipal}  ->  Destino Principal: ${destinoPrincipal}`, margin, y);
  y += 4.5;
  if (deca.stops && deca.stops.length > 0) {
    doc.text(`Paradas Intermedias: ${deca.stops.join(' -> ')}`, margin, y);
    y += 4.5;
  }
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...ORANGE);
  doc.text(`Fecha de Realización del Transporte: ${fechaCorta(deca.route.plannedStartDate)}`, margin, y);
  y += 9;

  // --- 2. TRANSPORTISTA EFECTIVO ---
  y = sectionHeader('2. TRANSPORTISTA EFECTIVO (EMPRESA DE TRANSPORTE)', y);

  doc.setTextColor(...GRAY_DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Empresa: ${deca.carrier.companyName}  |  NIF/CIF: ${deca.carrier.cif}`, margin, y);
  y += 4.5;
  doc.text(`Conductor: ${deca.carrier.driverName} (${deca.carrier.driverDni})`, margin, y);
  y += 4.5;
  doc.text(`Tractora: ${deca.carrier.tractorPlate}  |  Remolque: ${deca.carrier.trailerPlate || 'N/A'}  |  Teléfono: ${deca.carrier.phone || 'N/A'}`, margin, y);
  y += 4.5;
  doc.text(`Domicilio: ${deca.carrier.address}`, margin, y);
  y += 9;

  // --- 3. DESGLOSE OBLIGATORIO DE ENVÍOS ---
  y = sectionHeader('3. DESGLOSE OBLIGATORIO DE ENVÍOS AGRUPADOS', y);

  doc.setFillColor(...GRAY_BG);
  doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const colRef = margin + 2;
  const colOrigen = margin + 24;
  const colDestino = margin + 78;
  const colNaturaleza = margin + 128;
  const colPeso = pageWidth - margin - 2;
  doc.text('#/Ref', colRef, y + 4);
  doc.text('Origen (Cargador / Dirección)', colOrigen, y + 4);
  doc.text('Destino (Consignatario)', colDestino, y + 4);
  doc.text('Naturaleza / Bultos', colNaturaleza, y + 4);
  doc.text('Peso', colPeso, y + 4, { align: 'right' });
  y += 6;

  let totalBultos = 0;
  let totalPeso = 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_DARK);
  deca.shipments.forEach((s, idx) => {
    totalBultos += s.packageCount;
    totalPeso += s.grossWeightKg;

    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 252);
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    }

    doc.text(`${idx + 1}. ${s.trackingNumber}`, colRef, y + 4);
    doc.text(truncateToWidth(s.originAddress, colDestino - colOrigen - 3), colOrigen, y + 4);
    doc.text(truncateToWidth(s.destinationAddress, colNaturaleza - colDestino - 3), colDestino, y + 4);
    doc.text(truncateToWidth(`${s.goodsDescription} (${s.packageCount})`, colPeso - colNaturaleza - 12), colNaturaleza, y + 4);
    doc.text(`${s.grossWeightKg} kg`, colPeso, y + 4, { align: 'right' });
    y += 8;
  });

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(`TOTAL AGRUPACIÓN: ${deca.shipments.length} ENVÍOS  ·  ${totalBultos} BULTOS TOTALES`, margin, y);
  y += 4.5;
  doc.text(`PESO TOTAL CARGA: ${totalPeso} KG (${(totalPeso / 1000).toFixed(2)} TONELADAS)`, margin, y);
  y += 9;

  // --- 4. HISTORIAL DE MODIFICACIONES ---
  y = sectionHeader('4. HISTORIAL DE MODIFICACIONES EN RUTA', y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (deca.history && deca.history.length > 0) {
    deca.history.forEach((h) => {
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.text(`v${h.version}  ·  ${fechaLarga(h.timestamp)}  ·  ${h.reason}`, margin, y);
      y += 4.3;
      if (h.field) {
        doc.setTextColor(...ORANGE);
        doc.text(`Campo modificado: ${h.field} — Antes: "${h.previousValue || 'N/A'}" -> Ahora: "${h.newValue || 'N/A'}"`, margin, y);
        y += 4.3;
      }
      if (h.details) {
        doc.setTextColor(...GRAY_DARK);
        doc.setFont('helvetica', 'normal');
        doc.text(`Detalle: ${h.details}`, margin, y);
        y += 4.3;
      }
      doc.setTextColor(...GRAY_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.text(`Modificado por: ${h.modifiedBy}  |  Hash: ${h.qrHash}`, margin, y);
      y += 5.5;
    });
  } else {
    doc.setTextColor(...GRAY_DARK);
    doc.text(`v${deca.version}  ·  ${fechaLarga(deca.creationDate)}  ·  EMISION_INICIAL`, margin, y);
    y += 4.3;
    doc.text(`Detalle: Generación inicial de DeCA con ${deca.shipments.length} envíos agrupados.`, margin, y);
    y += 7;
  }

  // --- 5. OBSERVACIONES / RESERVAS ---
  if (deca.observations && deca.observations.trim().length > 0) {
    y = sectionHeader('5. OBSERVACIONES / RESERVAS', y);

    doc.setTextColor(...GRAY_DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const observacionesLines = doc.splitTextToSize(deca.observations, pageWidth - margin * 2);
    doc.text(observacionesLines, margin, y);
    y += observacionesLines.length * 4.3 + 5;
  }

  // --- PIE DE PÁGINA ---
  y += 1;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('OBLIGACIÓN LEGAL DE CONSERVACIÓN Y METADATOS DE INTEGRIDAD', margin, y);
  y += 4;

  doc.setTextColor(...GRAY_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('1. Archivo legal obligatorio durante un mínimo de 1 año (Fecha límite legal de conservación: ' + fechaCorta(deca.legalRetentionExpiresDate) + ').', margin, y);
  y += 3.5;
  doc.text(`2. Sello de Integridad (Hash): ${deca.digitalSignature}`, margin, y);
  y += 3.5;
  doc.text('3. Validez técnica verificada mediante código Hash e interoperabilidad oficial según Orden FOM/2861/2012 y Real Decreto BOE.', margin, y);
  y += 6;

  doc.setTextColor(...ORANGE);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(7.5);
  doc.text('OPERPAL · Operador Logístico de Palma del Río, S.L.', margin, y);

  const blob = doc.output('blob');
  return { blob, sizeBytes: blob.size, qrDataUrl };
}
