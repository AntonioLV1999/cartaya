import { useEffect, useRef, useState } from 'react';
import { ALERGENOS } from '../../../server/alergenos.js';
import { centimosATexto } from '../../../server/precio.js';
import { api } from './api.js';
import { validarFoto, reducirFoto } from './fotos.js';

export const MAX_DESCRIPCION = 140;

function MensajeError({ id, mensaje }) {
  if (!mensaje) return null;
  return (
    <p id={id} className="error" role="alert">
      {mensaje}
    </p>
  );
}

/**
 * Formulario de plato (crear o editar). Guarda los datos y, si se eligió, sube la foto ya reducida.
 * `plato` es null para uno nuevo.
 */
export function FormPlato({ plato, categorias, categoriaInicial, operar, onTerminar, reducir = reducirFoto }) {
  const [nombre, setNombre] = useState(plato?.nombre ?? '');
  const [precio, setPrecio] = useState(plato ? centimosATexto(plato.precioCentimos) : '');
  const [descripcion, setDescripcion] = useState(plato?.descripcion ?? '');
  const [categoriaId, setCategoriaId] = useState(String(plato?.categoriaId ?? categoriaInicial ?? categorias[0]?.id ?? ''));
  const [alergenos, setAlergenos] = useState(plato?.alergenos ?? []);
  const [sinAlergenos, setSinAlergenos] = useState(plato?.sinAlergenos ?? false);
  const [foto, setFoto] = useState(null); // Blob listo para subir
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const creado = useRef(null);

  useEffect(() => () => vistaPrevia && URL.revokeObjectURL(vistaPrevia), [vistaPrevia]);

  const prefijo = plato ? `plato-${plato.id}` : 'plato-nuevo';
  const idCampo = (c) => `${prefijo}-${c}`;
  const describir = (c) => (errores[c] ? `${idCampo(c)}-error` : undefined);
  const longitud = [...descripcion].length;

  function alternarAlergeno(codigo) {
    setAlergenos((a) => (a.includes(codigo) ? a.filter((x) => x !== codigo) : [...a, codigo]));
  }

  async function elegirFoto(evento) {
    const fichero = evento.target.files?.[0];
    setErrores((e) => ({ ...e, foto: null }));
    if (!fichero) return;
    const error = validarFoto(fichero);
    if (error) {
      setFoto(null);
      evento.target.value = '';
      return setErrores((e) => ({ ...e, foto: error }));
    }
    const reducida = await reducir(fichero);
    setFoto(reducida);
    setQuitarFoto(false);
    if (typeof URL.createObjectURL === 'function') setVistaPrevia(URL.createObjectURL(reducida));
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    const datos = { nombre, precio, descripcion, categoriaId: Number(categoriaId), alergenos, sinAlergenos };
    const error = await operar(async () => {
      // Si el plato nuevo ya se creó pero falló la foto, el reintento edita en vez de duplicarlo.
      const id = plato?.id ?? creado.current;
      const guardado = id
        ? await api('PATCH', `/api/admin/platos/${id}`, datos)
        : await api('POST', '/api/admin/platos', datos);
      creado.current = guardado.id;
      if (foto) await api('PUT', `/api/admin/platos/${guardado.id}/foto`, foto);
      else if (quitarFoto && plato?.foto) await api('DELETE', `/api/admin/platos/${guardado.id}/foto`);
    }, `Plato «${nombre.trim()}» guardado.`);
    setGuardando(false);
    if (error) setErrores({ [error.campo ?? 'general']: error.mensaje });
    else onTerminar();
  }

  return (
    <form className="formulario fila" onSubmit={guardar} noValidate aria-labelledby={idCampo('titulo')}>
      <h3 id={idCampo('titulo')}>{plato ? `Editar «${plato.nombre}»` : 'Nuevo plato'}</h3>

      <div className="campo">
        <label htmlFor={idCampo('nombre')}>Nombre</label>
        <input id={idCampo('nombre')} type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
          aria-invalid={errores.nombre ? 'true' : undefined} aria-describedby={describir('nombre')} />
        <MensajeError id={`${idCampo('nombre')}-error`} mensaje={errores.nombre} />
      </div>

      <div className="campo">
        <label htmlFor={idCampo('precio')}>Precio en euros (IVA incluido)</label>
        <input id={idCampo('precio')} type="text" inputMode="decimal" placeholder="Por ejemplo, 3,50" value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          aria-invalid={errores.precio ? 'true' : undefined} aria-describedby={describir('precio')} />
        <MensajeError id={`${idCampo('precio')}-error`} mensaje={errores.precio} />
      </div>

      <div className="campo">
        <label htmlFor={idCampo('descripcion')}>Descripción corta (opcional)</label>
        <textarea id={idCampo('descripcion')} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          aria-invalid={errores.descripcion || longitud > MAX_DESCRIPCION ? 'true' : undefined}
          aria-describedby={`${idCampo('descripcion')}-contador ${describir('descripcion') ?? ''}`.trim()} />
        <p id={`${idCampo('descripcion')}-contador`} className={longitud > MAX_DESCRIPCION ? 'error' : 'ayuda'}>
          {longitud} de {MAX_DESCRIPCION} caracteres
        </p>
        <MensajeError id={`${idCampo('descripcion')}-error`} mensaje={errores.descripcion} />
      </div>

      <div className="campo">
        <label htmlFor={idCampo('categoria')}>Categoría</label>
        <select id={idCampo('categoria')} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
          aria-invalid={errores.categoriaId ? 'true' : undefined} aria-describedby={describir('categoriaId')}>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <MensajeError id={`${idCampo('categoriaId')}-error`} mensaje={errores.categoriaId} />
      </div>

      <fieldset className="campo" aria-describedby={describir('alergenos')}>
        <legend>Alérgenos (marque los que contiene, o «Sin alérgenos»)</legend>
        <div className="alergenos-lista">
          {ALERGENOS.map((a) => (
            <label key={a.codigo} className="casilla">
              <input type="checkbox" name="alergeno" value={a.codigo} checked={alergenos.includes(a.codigo)}
                onChange={() => alternarAlergeno(a.codigo)} />
              {a.nombre}
            </label>
          ))}
        </div>
        <label className="casilla">
          <input type="checkbox" name="sin-alergenos" checked={sinAlergenos} onChange={(e) => setSinAlergenos(e.target.checked)} />
          <strong>Sin alérgenos</strong>
        </label>
        <MensajeError id={`${idCampo('alergenos')}-error`} mensaje={errores.alergenos} />
      </fieldset>

      <div className="campo">
        <label htmlFor={idCampo('foto')}>Foto (opcional): JPEG, PNG o WebP de hasta 5 MB</label>
        {(vistaPrevia || (plato?.foto && !quitarFoto)) && (
          <img className="plato__foto" src={vistaPrevia ?? plato.foto} alt="Vista previa de la foto" width="800" height="600" />
        )}
        <input id={idCampo('foto')} type="file" accept="image/jpeg,image/png,image/webp" onChange={elegirFoto}
          aria-invalid={errores.foto ? 'true' : undefined} aria-describedby={describir('foto')} />
        <MensajeError id={`${idCampo('foto')}-error`} mensaje={errores.foto} />
        {plato?.foto && !quitarFoto && !foto && (
          <div className="acciones">
            <button className="boton boton--peligro" type="button" onClick={() => setQuitarFoto(true)}>
              Quitar la foto
            </button>
          </div>
        )}
        {quitarFoto && <p className="ayuda">La foto se quitará al guardar.</p>}
      </div>

      <MensajeError id={`${idCampo('general')}-error`} mensaje={errores.general} />

      <div className="acciones">
        <button className="boton" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar plato'}
        </button>
        <button className="boton boton--secundario" type="button" onClick={onTerminar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
