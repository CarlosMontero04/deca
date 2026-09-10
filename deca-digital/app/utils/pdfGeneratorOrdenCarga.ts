import { jsPDF } from 'jspdf';
import { OPERPAL_LOGO_BASE64, OPERPAL_LOGO_WIDTH_PX, OPERPAL_LOGO_HEIGHT_PX } from './logoBase64';

const NAVY: [number, number, number] = [42, 22, 112];
const ORANGE: [number, number, number] = [233, 136, 55];
const GRAY_DARK: [number, number, number] = [45, 45, 45];
const GRAY_BG: [number, number, number] = [246, 244, 251];
const BORDER: [number, number, number] = [190, 188, 200];

export interface OrdenCarga {
  id: string;
  fecha: string;
  carrierName: string;
  carrierEmail?: string;
  carrierPhone?: string;
  carrierPlates?: string;
  fechaCarga?: string;
  origen?: string;
  fechaDescarga?: string;
  destino?: string;
  mercancia?: string;
  precioConcertado?: string;
  observaciones?: string;
}

// Condiciones fijas de OPERPAL — mismas en todas las órdenes de carga,
// reproducidas de vuestra plantilla original.
const CONDICIONES = [
  'Facturar siempre peso descargado en destino.',
  'Forma de pago: pagare a 60 dias fecha recepción factura y albaranes originales.',
  'Para el pago de la factura, es de obligado cumplimiento nos remitan certificados de estar al corriente con Hacienda y Seguridad Social.',
  'La factura se aceptará con la carta de porte, CMR, originales o albaranes debidamente firmados y sellados, incluyendo DNI del responsable de la recepción de la mercancía.',
  'El conductor deberá realizar el control de la carga y descarga de la mercancía asegurando la correcta colocación y estabilidad de esta y tiene la obligación de examinar con detalle la mercancía en el momento que vaya a cargar el vehículo, así mismo deberá informar a Operpal en el mismo momento de la carga, si observara alguna anomalía en la misma.',
  'Siempre que el receptor de la mercancía haga observaciones o reclamaciones a la llegada de la mercancía o que haya una diferencia de peso o en la cantidad de pallets se deberá contactar e informar inmediatamente a Operpal desde el mismo lugar en que ocurra la discrepancia y seguir las instrucciones que les demos al conductor.',
  'El propietario del vehículo se hace cargo de la mercancía consignada en la presente orden, siendo responsable de las faltas, pérdidas, mojaduras, deterioros o cualquier otra anomalía que durante su transporte se produjeran, quedando exento de responsabilidades a todos los efectos esta agencia.',
  'Queda terminantemente prohibido contactar con nuestro cliente salvo que esta orden indique lo contrario. Se mantendrá siempre neutralidad hacia el mismo.',
  'En caso de cargar mercancías perecederas, el conductor deberá de estar pendiente en todo momento de la carga, y ante cualquier incidencia de podredumbre o mal estado de esta, deberá parar la misma y avisar a nuestro departamento de tráfico, el cual le dará las instrucciones a seguir.',
  'En caso de transportar cualquier tipo de mercancía a granel o en otro formato, que se destine a consumo humano o animal, se deberá presentar la plataforma, previa a la carga, en excelentes condiciones de limpieza, seca y sin olores, con la lona en perfectas condiciones, para cumplir con el protocolo de buenas prácticas para el transporte de este tipo de mercancías, siendo imprescindible la presentación de certificado de limpieza si el cliente y esta orden de carga así lo exigen. Tener el material en buen estado, limpio y estanco. Así mismo dispondrán del registro sanitario correspondiente.',
  "El/los vehículo/s contratados para este transporte debe/n estar obligatoriamente provistos y estar en posesión de la documentación necesaria y exigida por la ley bajo condiciones LOTT o CMR, en función del transporte a realizar, y cumplir con toda la legislación vigente que rige en el transporte de mercancías (seguros obligatorios, Prevención de Riesgos Laborales, legislación laboral, Epi's, ITV, tarjeta de transporte, etc.) y disponer de las licencias y autorizaciones necesarias para el tipo de mercancía transportada, así como pólizas de seguro, seguro de mercancías y de responsabilidad civil que cubran la responsabilidad del porteador frente a la mercancía transportada. El conductor / transportista estará obligado a cumplimentar debidamente el CMR o Carta de Porte (Documento de Control de Transporte Orden FOM/238/2003 de 31 de enero) y entregarla al destinatario, siendo este responsable de cualquier sanción derivada de la ausencia o deficiencia en la obligación de cumplimentar dichos documentos, así como de la inexactitud de los datos recogidos en los mismos y la falta de todos o algunos de los datos que conforme a la citada legislación sea necesario consignar en estos.",
  'El seguro de mercancía correrá a cargo del transportista, aún en caso de subcontratación, según ley 15/2009 de Contrato de Transporte de Mercancías, así como todos los gastos necesarios para realizar el transporte incluyendo imprevistos.',
  'Se prohíbe el transbordo de la mercancía sin autorización por escrito de Operpal, asimismo, en la contratación de cargas completas en caso de que quede espacio libre, no se pueden cargar otras mercancías de otros clientes ajenos a Operador Logístico de Palma del Rio.',
  'Se deberán cumplir los horarios de carga y descarga. Ante cualquier retraso, se deberá informar a Operpal tan pronto como se tenga conocimiento de los hechos que ocasionen o puedan ocasionar el retraso.',
  'No se aceptará ninguna paralización por anulación de la carga debido a inclemencias del tiempo, por falta de mercancía, ni por duración indeterminada de la carga o de la descarga que no sea acordada previamente. Para mercancías que se carguen en el campo, siempre se tendrán en cuenta las inclemencias del tiempo, para ello, llamar antes de desplazarse asegurando bien la carga antes de salir.',
  'Cualquier variación o duda sobre las instrucciones dadas en esta orden de carga, así como cualquier incidencia en el curso de este transporte, deberá ser comunicada inmediatamente a Operpal – Operador Logístico de Palma del Río, tlfs. 696958596 – 662913829, de lo contrario, será responsabilidad del porteador efectivo las consecuencias que se pudieran originar.',
  'Cualquier controversia de carácter mercantil surgida en relación con el cumplimiento, ejecución o interpretación del presente contrato de transporte, se someterá a la competencia de la Junta Arbitral de Transportes de Cordoba y/o a los Tribunales de Cordoba, con renuncia expresa a otro fuero que le pudiera corresponder.',
  'De acuerdo con la Ley 15/1999 de Protección de datos de carácter personal, Operador Logístico de Palma del Río le informa que Vd. considera este documento como aceptación, como consentimiento informado y como autorización para el tratamiento automatizado de sus datos de carácter personal para fines propios de nuestra actividad. Vd. tiene en cualquier momento derecho de acceso, rectificación, cancelación u oposición dirigiéndose a nuestro domicilio. Este documento y cualquier documento anexo contienen información privada y confidencial única y exclusivamente para el destinatario de este. Si usted no es el destinatario, no tiene autorización para leer, copiar, usar o distribuir este documento ni los documentos anexos. En caso de haber recibido esta comunicación por error, le rogamos la remita al emisor y la destruya posteriormente.',
  'El transportista efectivo declara que el precio acordado cubre el coste individual que ha de soportar para la realización del transporte, la realización del viaje implica que el transportista efectivo acepta que el precio cubre sus costes para la realización del mismo.',
  'Salvo indicación expresa por su parte, entendemos las presentes condiciones aceptadas y conformes.',
];

export async function generateOrdenCargaPdf(orden: OrdenCarga) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const fechaCorta = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-ES') : '—');

  // Salta de página si no queda espacio suficiente para lo siguiente
  const ensureSpace = (currentY: number, needed: number) => {
    if (currentY + needed > pageHeight - 15) {
      doc.addPage();
      return 15;
    }
    return currentY;
  };

  // --- CABECERA (igual que vuestra plantilla real) ---
  const logoWidth = 38;
  const logoHeight = logoWidth * (OPERPAL_LOGO_HEIGHT_PX / OPERPAL_LOGO_WIDTH_PX);
  doc.addImage(OPERPAL_LOGO_BASE64, 'PNG', margin, 12, logoWidth, logoHeight);

  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Operador Logístico de Palma del Río SL', pageWidth - margin, 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_DARK);
  const headerLines = [
    'Polig Ind Mataché, Centro Serv Integrados Mod C H',
    'Apdo. Correos 231. 14700 Palma del Río (Córdoba)',
    'B-14746523',
    'Tlf.: 957643448 / 957710325',
    'operpal@operpal.com',
  ];
  headerLines.forEach((line, i) => {
    doc.text(line, pageWidth - margin, 19 + i * 4, { align: 'right' });
  });

  let y = 42;
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ORDEN DE CARGA', pageWidth / 2, y, { align: 'center' });
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  const titleWidth = doc.getTextWidth('ORDEN DE CARGA');
  doc.line(pageWidth / 2 - titleWidth / 2, y + 1.5, pageWidth / 2 + titleWidth / 2, y + 1.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_DARK);
  doc.text(`Nº ${orden.id}`, pageWidth / 2, y + 6, { align: 'center' });
  y += 14;

  // --- TABLA DE DATOS (celdas con borde, como vuestra plantilla) ---
  // Cada caja se adapta al contenido: si el valor es largo, la fila crece
  // (envuelve el texto en varias líneas) en vez de desbordar o cortarse.
  const labelWidth = 48;
  const minRowH = 7.5;
  const lineHeight = 3.6;
  const drawRow = (label: string, value: string) => {
    const valueWidth = pageWidth - margin * 2 - labelWidth - 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(value || '—', valueWidth);
    const neededH = Math.max(minRowH, lines.length * lineHeight + 3.5);

    // Si esta fila no cabe entera en lo que queda de página, saltamos de página
    if (y + neededH > pageHeight - 15) {
      doc.addPage();
      y = 15;
    }

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.setFillColor(...GRAY_BG);
    doc.rect(margin, y, labelWidth, neededH, 'FD');
    doc.rect(margin + labelWidth, y, pageWidth - margin * 2 - labelWidth, neededH, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text(label, margin + 2.5, y + (lines.length === 1 ? neededH / 2 + 1.5 : 5));
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_DARK);
    doc.text(lines, margin + labelWidth + 2.5, y + (lines.length === 1 ? neededH / 2 + 1.5 : 5));
    y += neededH;
  };

  drawRow('Fecha.:', fechaCorta(orden.fecha));
  drawRow('Empresa.:', orden.carrierName);
  drawRow('E Mail.:', orden.carrierEmail || '—');
  drawRow('Teléfono.:', orden.carrierPhone || '—');
  drawRow('Matrículas.:', orden.carrierPlates || '—');
  drawRow('Fecha de carga.:', fechaCorta(orden.fechaCarga));
  drawRow('Origen.:', orden.origen || '—');
  drawRow('Fecha de descarga.:', fechaCorta(orden.fechaDescarga));
  drawRow('Destino.:', orden.destino || '—');
  drawRow('Mercancía.:', orden.mercancia || '—');

  y += 6;
  drawRow('Precio concertado.:', orden.precioConcertado || '—');
  drawRow('Observaciones.:', orden.observaciones || '—');

  y += 8;

  // --- CONDICIONES DEL TRANSPORTE ---
  // Salto de página forzado: la página 1 es solo la información del viaje,
  // la página 2 empieza siempre con las condiciones — igual que vuestra plantilla original.
  doc.addPage();
  y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('Condiciones del transporte:', margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_DARK);
  const maxWidth = pageWidth - margin * 2 - 3;

  CONDICIONES.forEach((condicion) => {
    const lines = doc.splitTextToSize(`•  ${condicion}`, maxWidth);
    y = ensureSpace(y, lines.length * 3.4 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 3.4 + 1.8;
  });

  const blob = doc.output('blob');
  return { blob, sizeBytes: blob.size };
}
