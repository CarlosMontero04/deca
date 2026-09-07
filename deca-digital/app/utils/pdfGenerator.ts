import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { DecaDocument } from '../types';

export async function generateDecaPdf(deca: DecaDocument, verificationUrl: string) {
  // 1. Generar el Código QR
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 300,
    color: { dark: '#002B49', light: '#FFFFFF' },
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = 12;

  // --- CABECERA OFICIAL ---
  doc.setFillColor(0, 43, 73); // Azul corporativo oscuro
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DOCUMENTO DE CONTROL ADMINISTRATIVO EN EL TRANSPORTE', margin, 10);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('REGLAMENTACIÓN BOE - NORMAS SOBRE DIGITALIZACIÓN OBLIGATORIA (PAPEL CERO 2026)', margin, 15);
  doc.text(`CÓDIGO ÚNICO: ${deca.id} | VERSIÓN: v${deca.version}.0 | ESTADO: ${deca.status}`, margin, 20);
  doc.text('INSPECCIÓN EN CARRETERA (DGT / MINISTERIO DE TRANSPORTES):', margin, 25);
  doc.text('Documento nativo digital válido sin firma manuscrita. Las autoridades pueden escanear el QR.', margin, 29);

  // Insertar QR arriba a la derecha
  doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 26, 3, 26, 26);

  y = 38;

  // --- 1. TRANSPORTISTA EFECTIVO ---
  doc.setTextColor(0, 43, 73);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('1. TRANSPORTISTA EFECTIVO (EMPRESA DE TRANSPORTE)', margin, y);
  y += 5;

  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Empresa: ${deca.carrier.companyName} | NIF/CIF: ${deca.carrier.cif}`, margin, y);
  y += 4;
  doc.text(`Conductor: ${deca.carrier.driverName} (${deca.carrier.driverDni})`, margin, y);
  y += 4;
  doc.text(`Tractora: ${deca.carrier.tractorPlate} | Remolque: ${deca.carrier.trailerPlate || 'N/A'} | Teléfono: ${deca.carrier.phone || 'N/A'}`, margin, y);
  y += 4;
  doc.text(`Domicilio: ${deca.carrier.address}`, margin, y);
  y += 8;

  // --- 2. CARGADOR CONTRACTUAL ---
  doc.setTextColor(0, 43, 73);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('2. CARGADOR CONTRACTUAL (EMPRESA CONTRATANTE)', margin, y);
  y += 5;

  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Empresa: ${deca.contractualShipper.companyName} | NIF/CIF: ${deca.contractualShipper.cif}`, margin, y);
  y += 4;
  doc.text(`Contacto/Resp: ${deca.contractualShipper.contactName}`, margin, y);
  y += 4;
  doc.text(`Domicilio: ${deca.contractualShipper.address}`, margin, y);
  y += 4;
  doc.text(`Origen Principal: ${deca.route.originMain} | Destino Principal: ${deca.route.destinationMain}`, margin, y);
  y += 4;
  if (deca.stops && deca.stops.length > 0) {
    doc.text(`Paradas Intermedias: ${deca.stops.join(' → ')}`, margin, y);
    y += 4;
  }
  doc.setFont('helvetica', 'bold');
  doc.text(`Fecha de Realización del Transporte: ${new Date(deca.route.plannedStartDate).toLocaleDateString()}`, margin, y);
  doc.setFont('helvetica', 'normal');
  y += 8;

  // --- 3. DESGLOSE OBLIGATORIO DE ENVÍOS ---
  doc.setTextColor(0, 43, 73);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('3. DESGLOSE OBLIGATORIO DE ENVÍOS AGRUPADOS (EXIGENCIA NORMATIVA BOE)', margin, y);
  y += 6;

  // Tabla de envíos (Cabecera)
  doc.setFillColor(240, 243, 246);
  doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
  doc.setTextColor(0, 43, 73);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('#/Ref', margin + 2, y + 4);
  doc.text('Origen (Cargador / Dirección)', margin + 25, y + 4);
  doc.text('Destino (Consignatario)', margin + 85, y + 4);
  doc.text('Naturaleza / Bultos', margin + 135, y + 4);
  doc.text('Peso', pageWidth - margin - 15, y + 4, { align: 'right' });
  y += 6;

  // Filas de envíos
  let totalBultos = 0;
  let totalPeso = 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  deca.shipments.forEach((s, idx) => {
    totalBultos += s.packageCount;
    totalPeso += s.grossWeightKg;

    doc.text(`${idx + 1}. ${s.trackingNumber}`, margin + 2, y + 4);
    doc.text(s.originAddress.substring(0, 40), margin + 25, y + 4);
    doc.text(s.destinationAddress.substring(0, 35), margin + 85, y + 4);
    doc.text(`${s.goodsDescription} (${s.packageCount})`, margin + 135, y + 4);
    doc.text(`${s.grossWeightKg} kg`, pageWidth - margin - 2, y + 4, { align: 'right' });
    y += 8;
  });

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL AGRUPACIÓN: ${deca.shipments.length} ENVÍOS | ${totalBultos} BULTOS TOTALES`, margin, y);
  y += 4;
  doc.text(`PESO TOTAL CARGA: ${totalPeso} KG (${(totalPeso / 1000).toFixed(2)} TONELADAS)`, margin, y);
  y += 8;

  // --- 4. HISTORIAL DE MODIFICACIONES ---
  doc.setTextColor(0, 43, 73);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('4. HISTORIAL DE MODIFICACIONES EN RUTA (PROHIBIDAS ANOTACIONES MANUSCRITAS)', margin, y);
  y += 5;

  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (deca.history && deca.history.length > 0) {
    deca.history.forEach((h) => {
      doc.text(`Versión v${h.version} [${new Date(h.timestamp).toLocaleString()}] - Motivo: ${h.reason}`, margin, y);
      y += 4;
      if (h.field) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Campo modificado: ${h.field} — Antes: "${h.previousValue || 'N/A'}" → Ahora: "${h.newValue || 'N/A'}"`, margin, y);
        doc.setFont('helvetica', 'normal');
        y += 4;
      }
      if (h.details) {
        doc.text(`Detalle: ${h.details}`, margin, y);
        y += 4;
      }
      doc.text(`Modificado por: ${h.modifiedBy} | Hash: ${h.qrHash}`, margin, y);
      y += 5;
    });
  } else {
    doc.text(`Versión v${deca.version} [${new Date(deca.creationDate).toLocaleString()}] - Motivo: EMISION_INICIAL`, margin, y);
    y += 4;
    doc.text(`Detalle: Generación inicial de DeCA con ${deca.shipments.length} envíos agrupados.`, margin, y);
    y += 6;
  }

  // --- 5. OBSERVACIONES / RESERVAS (solo si se han indicado, art. 6.g) ---
  if (deca.observations && deca.observations.trim().length > 0) {
    doc.setTextColor(0, 43, 73);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('5. OBSERVACIONES / RESERVAS', margin, y);
    y += 5;

    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const observacionesLines = doc.splitTextToSize(deca.observations, pageWidth - margin * 2);
    doc.text(observacionesLines, margin, y);
    y += observacionesLines.length * 4 + 4;
  }

  // --- PIE DE PÁGINA / OBLIGACIÓN LEGAL ---
  y += 2;
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setTextColor(0, 43, 73);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('OBLIGACIÓN LEGAL DE CONSERVACIÓN Y FIRMA DIGITAL DE METADATOS:', margin, y);
  y += 4;

  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('1. Archivo legal obligatorio durante un mínimo de 1 año (Fecha límite legal de conservación: ' + new Date(deca.legalRetentionExpiresDate).toLocaleDateString() + ').', margin, y);
  y += 3.5;
  doc.text(`2. Firma Digital de Sellado de Tiempo: ${deca.digitalSignature}`, margin, y);
  y += 3.5;
  doc.text('3. Validez técnica verificada mediante código Hash e interoperabilidad oficial según Orden FOM/2861/2012 y Real Decreto BOE.', margin, y);

  const blob = doc.output('blob');
  return { blob, sizeBytes: blob.size, qrDataUrl };
}