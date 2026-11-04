// Cliente mínimo de la API de administración.

export class ErrorApi extends Error {
  constructor(status, { campo = null, mensaje = 'Ha ocurrido un error. Inténtelo de nuevo.' } = {}) {
    super(mensaje);
    this.status = status;
    this.campo = campo;
    this.mensaje = mensaje;
  }
}

/**
 * Llama a la API. `cuerpo` se envía como JSON salvo que sea un Blob (foto), que va tal cual.
 * Lanza ErrorApi con `{status, campo, mensaje}` si la respuesta no es correcta.
 */
export async function api(metodo, ruta, cuerpo) {
  const opciones = { method: metodo, credentials: 'same-origin', headers: {} };
  if (cuerpo instanceof Blob) {
    opciones.body = cuerpo;
    opciones.headers['Content-Type'] = cuerpo.type;
  } else if (cuerpo !== undefined || ['POST', 'PATCH', 'PUT'].includes(metodo)) {
    opciones.body = JSON.stringify(cuerpo ?? {});
    opciones.headers['Content-Type'] = 'application/json';
  }
  let r;
  try {
    r = await fetch(ruta, opciones);
  } catch {
    throw new ErrorApi(0, { mensaje: 'No hay conexión con el servidor. Compruebe la red e inténtelo de nuevo.' });
  }
  if (r.status === 204) return null;
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorApi(r.status, datos);
  return datos;
}
