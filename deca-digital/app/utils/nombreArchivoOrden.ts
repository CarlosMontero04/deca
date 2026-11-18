// Nombre con el que se descarga el PDF de una orden de carga:
//   «<identificador> - <transportista>.pdf»   →   OC-2026-0123 - Transportes Garmagar.pdf
// Solo cambia el nombre de la descarga; el fichero guardado en Supabase mantiene el suyo.

// Longitud máxima de la parte del transportista (el identificador nunca se recorta).
const MAX_TRANSPORTISTA = 40;

// Formas societarias: se escriben sin puntos y en mayúsculas (S.L. → SL).
const SOCIEDADES = new Set(['SL', 'SLU', 'SA', 'SAU', 'SC', 'SCA', 'SCP', 'SLL', 'CB']);

export function nombreTransportistaParaArchivo(nombre?: string | null, max = MAX_TRANSPORTISTA): string {
  let t = (nombre ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')   // caracteres que Windows no admite en nombres de archivo
    .replace(/,(?=\S)/g, ', ')                      // «BARMOÑCAR,S.L.» → «BARMOÑCAR, S.L.»
    .replace(/\s+/g, ' ')                           // espacios y saltos de línea → un solo espacio
    .trim();
  if (!t) return '';

  // S.L. / S.L.U. → SL / SLU
  t = t.split(' ').map(p => {
    const letras = p.replace(/[.,]/g, '');
    return SOCIEDADES.has(letras.toUpperCase()) ? letras.toUpperCase() : p;
  }).join(' ');

  // Si viene todo en mayúsculas, se pasa a «Inicial Mayúscula» por legibilidad (los SL/SA se respetan).
  if (t === t.toUpperCase() && t !== t.toLowerCase()) {
    t = t.toLowerCase().split(' ').map(p => {
      const letras = p.replace(/[.,]/g, '');
      return SOCIEDADES.has(letras.toUpperCase()) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');
  }

  // Corte por palabra completa: nos quedamos con la última palabra que cabe entera.
  if (t.length > max) {
    const corte = t.slice(0, max + 1);              // +1 para saber si justo después hay un espacio
    const ultimoEspacio = corte.lastIndexOf(' ');
    t = ultimoEspacio > 0 ? corte.slice(0, ultimoEspacio) : t.slice(0, max);
  }

  // Windows no admite nombres que acaben en punto o espacio.
  return t.replace(/[\s.,-]+$/, '');
}

export function nombreArchivoOrden(id: string, transportista?: string | null): string {
  const t = nombreTransportistaParaArchivo(transportista);
  return t ? `${id} - ${t}.pdf` : `${id}.pdf`;
}
