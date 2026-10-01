// Genera un archivo Excel (.xlsx) con una hoja por cada categoría de la
// flota (Transportistas, Conductores, Tractoras, Remolques, Ubicaciones,
// Otros Cargadores). Usa los datos ya cargados en pantalla — no hace
// ninguna consulta nueva a la base de datos, así que es instantáneo.

import ExcelJS from 'exceljs';

export type FleetSheet = {
  name: string; // nombre de la pestaña (Excel limita a 31 caracteres)
  columns: { header: string; key: string; width?: number }[];
  rows: Record<string, string | number>[];
};

const HEADER_FILL = 'FF2A1670'; // morado corporativo de DeCA Digital

function styleSheet(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: 'middle' };
  header.height = 20;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function buildFleetWorkbook(sheets: FleetSheet[], authorEmail?: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DeCA Digital';
  wb.created = new Date();
  if (authorEmail) wb.lastModifiedBy = authorEmail;

  for (const s of sheets) {
    const sheet = wb.addWorksheet(s.name.slice(0, 31));
    sheet.columns = s.columns;
    s.rows.forEach(r => sheet.addRow(r));
    styleSheet(sheet);
  }
  return wb;
}

export async function downloadFleetExcel(sheets: FleetSheet[], fileName: string, authorEmail?: string) {
  const wb = await buildFleetWorkbook(sheets, authorEmail);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
