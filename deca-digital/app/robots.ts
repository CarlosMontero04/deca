import type { MetadataRoute } from 'next';

// Segunda capa de protección junto con la etiqueta "noindex" de
// app/verificar/layout.tsx: esto le pide a los rastreadores que ni siquiera
// entren a esas páginas. La etiqueta noindex sigue siendo la protección
// principal (un rastreador que no respete robots.txt igualmente vería el
// noindex), pero entre las dos capas se reduce al mínimo la posibilidad de
// que un DeCA acabe apareciendo en un buscador.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/verificar/',
    },
  };
}
