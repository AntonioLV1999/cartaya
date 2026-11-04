import qrcode from 'qrcode-generator';

export const MARGEN_QR = 4; // zona de silencio estándar, en módulos

/** Matriz de módulos (true = oscuro) del QR de un texto, con corrección de errores M. */
export function matrizQR(texto) {
  const qr = qrcode(0, 'M');
  qr.addData(texto, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, f) => Array.from({ length: n }, (_, c) => qr.isDark(f, c)));
}

/** SVG escalable del QR: un cuadrado de 1×1 por módulo oscuro, desplazado por el margen. */
export function svgQR(texto) {
  const matriz = matrizQR(texto);
  const lado = matriz.length + MARGEN_QR * 2;
  let d = '';
  matriz.forEach((fila, f) =>
    fila.forEach((oscuro, c) => {
      if (oscuro) d += `M${c + MARGEN_QR},${f + MARGEN_QR}h1v1h-1z`;
    }),
  );
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" role="img">` +
    `<rect width="${lado}" height="${lado}" fill="#fff"/><path fill="#000" d="${d}"/></svg>`
  );
}

/** URL del QR de una mesa: dirección pública del local (o el origen de la petición) + /mesa/<código>. */
export function urlMesa(urlPublica, codigo) {
  return `${urlPublica.replace(/\/+$/, '')}/mesa/${codigo}`;
}
