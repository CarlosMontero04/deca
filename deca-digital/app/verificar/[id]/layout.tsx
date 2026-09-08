import type { Metadata } from 'next';

// Las páginas /verificar/[id] son de acceso público sin login, tal como exige
// la Resolución (Tercero.3/4) — eso es obligatorio y no se puede cambiar.
// Pero eso no significa que deban aparecer en buscadores: contienen datos
// personales (DNI y teléfono del conductor). Esta etiqueta le dice a Google
// y al resto de buscadores que no las indexen ni sigan sus enlaces, aunque
// alguien las enlace desde otro sitio.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function VerificarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
