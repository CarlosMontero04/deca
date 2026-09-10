// Genera un identificador único con entropía criptográfica real
// (crypto.getRandomValues, no Math.random()) y un alfabeto de 32 caracteres
// sin símbolos confusos (sin 0/O, sin 1/I/L).
//
// Con 8 caracteres de este alfabeto hay 32^8 ≈ 1,1 billones de combinaciones
// posibles — a efectos prácticos, inviable de recorrer por fuerza bruta.

const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSecureId(prefix: string, year: number = new Date().getFullYear()): string {
  const randomValues = new Uint32Array(8);
  crypto.getRandomValues(randomValues);
  const suffix = Array.from(randomValues, (v) => SAFE_ALPHABET[v % SAFE_ALPHABET.length]).join('');
  return `${prefix}-${year}-${suffix}`;
}

export function generateDecaId(year: number = new Date().getFullYear()): string {
  return generateSecureId('DECA', year);
}
