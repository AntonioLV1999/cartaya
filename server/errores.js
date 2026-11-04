/** Error de validación que la API devuelve como `{campo, mensaje}` (en español). */
export class ErrorValidacion extends Error {
  constructor(campo, mensaje, status = 422) {
    super(mensaje);
    this.campo = campo;
    this.mensaje = mensaje;
    this.status = status;
  }
}

export class NoEncontrado extends ErrorValidacion {
  constructor(mensaje = 'No se ha encontrado.') {
    super(null, mensaje, 404);
  }
}
