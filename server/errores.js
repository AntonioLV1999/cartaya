/** Error de validación que la API devuelve como `{campo, mensaje}` (en español). */
export class ErrorValidacion extends Error {
  constructor(campo, mensaje, status = 422) {
    super(mensaje);
    this.campo = campo;
    this.mensaje = mensaje;
    this.status = status;
  }
}

/** 409: la carta cambió mientras el visitante decidía. Lleva los platos retirados y los precios nuevos. */
export class ErrorCartaCambiada extends ErrorValidacion {
  constructor(mensaje, { retirados, precios }) {
    super(null, mensaje, 409);
    this.extra = { motivo: 'carta-cambiada', retirados, precios };
  }
}

export class NoEncontrado extends ErrorValidacion {
  constructor(mensaje = 'No se ha encontrado.') {
    super(null, mensaje, 404);
  }
}
