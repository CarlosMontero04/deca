// "Guardar como": deja elegir carpeta y nombre de archivo en vez de ir
// siempre a la carpeta de Descargas. Usa el diálogo nativo del navegador
// (File System Access API) cuando está disponible — hoy en día eso es
// Chrome y Edge de escritorio; Safari y Firefox no lo soportan todavía.
// Cuando no está disponible, cae automáticamente en la descarga de toda
// la vida (el método que ya usa el resto de la app).
//
// IMPORTANTE: el diálogo "Guardar como" solo se puede abrir dentro del
// mismo clic del usuario (si hay una espera de red antes, el navegador lo
// bloquea por seguridad). Por eso aquí se abre el diálogo ANTES de pedir
// el PDF, y el PDF se descarga justo después, ya con el sitio elegido.

type SaveAsResult = { success: boolean; cancelled?: boolean; error?: string };

export async function savePdfAs(getBlob: () => Promise<Blob>, suggestedName: string): Promise<SaveAsResult> {
  const w = window as any;

  if (w.showSaveFilePicker) {
    let handle;
    try {
      handle = await w.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'Documento PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') return { success: false, cancelled: true }; // el usuario cerró el diálogo
      handle = null; // el diálogo falló por otro motivo — seguimos con el método clásico
    }

    if (handle) {
      try {
        const blob = await getBlob();
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { success: true };
      } catch {
        return { success: false, error: 'No se pudo guardar el archivo en esa ubicación.' };
      }
    }
  }

  // Respaldo clásico: funciona en todos los navegadores, aunque no deja
  // elegir carpeta (va a donde el navegador tenga configuradas las
  // descargas, o pregunta si el usuario activó esa opción en Chrome).
  try {
    const blob = await getBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { success: true };
  } catch {
    return { success: false, error: 'No se pudo descargar el archivo.' };
  }
}
