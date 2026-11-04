// Día de servicio en hora de Madrid, compartido entre el servidor y el frontend (web/).

const diaMadrid = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Día de servicio (AAAA-MM-DD) en hora de Madrid, sea cual sea la zona del servidor o del móvil. */
export const diaDeServicio = (ms) => diaMadrid.format(new Date(ms));
