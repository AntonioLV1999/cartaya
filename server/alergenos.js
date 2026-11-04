// Los 14 alérgenos de declaración obligatoria (Reglamento (UE) n.º 1169/2011, anexo II).
// Compartido entre el servidor y el frontend (web/). La lista es legal, no del dueño:
// por eso vive en código y no en una tabla editable.
export const ALERGENOS = Object.freeze([
  { codigo: 'gluten', nombre: 'Gluten' },
  { codigo: 'crustaceos', nombre: 'Crustáceos' },
  { codigo: 'huevos', nombre: 'Huevos' },
  { codigo: 'pescado', nombre: 'Pescado' },
  { codigo: 'cacahuetes', nombre: 'Cacahuetes' },
  { codigo: 'soja', nombre: 'Soja' },
  { codigo: 'leche', nombre: 'Leche' },
  { codigo: 'frutos_cascara', nombre: 'Frutos de cáscara' },
  { codigo: 'apio', nombre: 'Apio' },
  { codigo: 'mostaza', nombre: 'Mostaza' },
  { codigo: 'sesamo', nombre: 'Sésamo' },
  { codigo: 'sulfitos', nombre: 'Dióxido de azufre y sulfitos' },
  { codigo: 'altramuces', nombre: 'Altramuces' },
  { codigo: 'moluscos', nombre: 'Moluscos' },
]);

export const CODIGOS_ALERGENOS = Object.freeze(ALERGENOS.map((a) => a.codigo));

const NOMBRES = Object.fromEntries(ALERGENOS.map((a) => [a.codigo, a.nombre]));

export function nombreAlergeno(codigo) {
  return NOMBRES[codigo] ?? codigo;
}
