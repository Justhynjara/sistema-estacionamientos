import { CONTACTO_LEGAL, NOMBRE_SITIO, ULTIMA_ACTUALIZACION } from './contenido.js';

export default function CookiePolicy() {
  return (
    <article>
      <h2>Política de Cookies</h2>
      <p style={{ color: 'var(--text-muted)' }}>Última actualización: {ULTIMA_ACTUALIZACION}</p>

      <p>{NOMBRE_SITIO} usa una sola cookie, y es estrictamente necesaria para funcionar:</p>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Nombre</th><th>Para qué sirve</th><th>Duración</th><th>¿Quién la lee?</th></tr></thead>
          <tbody>
            <tr>
              <td><code>token</code></td>
              <td>Mantenerte con la sesión iniciada si eres dueño de un estacionamiento, administrador o parte del equipo de soporte.</td>
              <td>8 horas, o hasta que cierres sesión</td>
              <td>Solo nuestro servidor. Tu navegador la guarda como <em>httpOnly</em>: ningún script (ni el nuestro ni uno malicioso que lograra colarse) puede leerla.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>¿Por qué no pedimos tu consentimiento para esta cookie?</h3>
      <p>
        Porque es <strong>estrictamente necesaria</strong>: sin ella, quien inicia sesión no podría
        seguir navegando como usuario autenticado. Tanto la normativa vigente como la Ley 21.719
        (que entra en vigor el 1 de diciembre de 2026) eximen a este tipo de cookies del
        consentimiento previo — a diferencia de las cookies de analítica o publicidad, que si
        alguna vez las usáramos, sí lo pedirían.
      </p>

      <h3>Lo que no usamos</h3>
      <p>
        No usamos cookies de analítica (como Google Analytics), de publicidad ni de redes sociales.
        No hay ningún rastreador de terceros cargando en este sitio. Si eso cambia en el futuro,
        actualizaremos esta página y pediremos tu consentimiento antes de activar cualquier cookie
        que no sea estrictamente necesaria, con la opción de rechazarla tan fácil como aceptarla.
      </p>
      <p>
        Al cargar el mapa de estacionamientos cercanos, las imágenes se piden a OpenStreetMap; ese
        servicio no instala cookies en tu navegador a través de este sitio, pero sí recibe tu
        dirección IP para poder entregar la imagen, como ocurre con cualquier mapa incrustado en
        cualquier página web.
      </p>

      <h3>Cómo borrar esta cookie</h3>
      <p>
        Puedes borrarla en cualquier momento desde la configuración de cookies de tu navegador; el
        único efecto es que se cerrará tu sesión y tendrás que volver a iniciarla.
      </p>

      <p>Dudas sobre esta política: <strong>{CONTACTO_LEGAL}</strong>.</p>
    </article>
  );
}
