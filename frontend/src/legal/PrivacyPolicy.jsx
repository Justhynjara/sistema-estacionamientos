import { CONTACTO_LEGAL, NOMBRE_SITIO, ULTIMA_ACTUALIZACION } from './contenido.js';

export default function PrivacyPolicy() {
  return (
    <article>
      <h2>Política de Privacidad</h2>
      <p style={{ color: 'var(--text-muted)' }}>Última actualización: {ULTIMA_ACTUALIZACION}</p>

      <p>
        Esta política explica qué datos personales recoge {NOMBRE_SITIO}, para qué los usa, con quién
        los comparte y qué derechos tienes sobre ellos, conforme a la Ley N.º 19.628 sobre Protección
        de la Vida Privada, vigente en Chile, y a la Ley N.º 21.719, que la reemplaza y entra en vigor
        el 1 de diciembre de 2026.
      </p>

      <h3>1. Qué datos recogemos</h3>
      <ul>
        <li><strong>Si buscas o reservas un cupo:</strong> ningún dato de cuenta — puedes usar esta función sin registrarte. Si reservas, guardamos la patente del vehículo (si la ingresas) y el registro del micropago de $100 CLP.</li>
        <li><strong>Si eres dueño de un estacionamiento, administrador o del equipo de soporte:</strong> nombre, email y una versión cifrada (no reversible) de tu contraseña — nunca guardamos la contraseña en texto plano.</li>
        <li><strong>Tickets de estacionamiento:</strong> patente (opcional), hora de entrada y salida, monto cobrado y método de pago. El pago en sí (efectivo o tarjeta) lo recibe directamente el dueño del estacionamiento en su propio POS; nosotros no lo procesamos ni vemos el número de tu tarjeta.</li>
        <li><strong>Si postulas tu estacionamiento:</strong> tu nombre, email, teléfono (opcional), la dirección y coordenadas del lugar, y las fotos que adjuntes.</li>
        <li><strong>Ubicación:</strong> si aceptas el permiso de geolocalización de tu navegador para buscar estacionamientos cercanos, esas coordenadas se usan solo para esa búsqueda puntual y no quedan guardadas en nuestros servidores.</li>
        <li><strong>Registro de auditoría:</strong> qué acción administrativa realizó cada administrador y cuándo (por ejemplo, cambiar una tarifa o crear un usuario). Es para trazabilidad interna, no para vigilar a quienes buscan o reservan estacionamiento.</li>
      </ul>
      <p>Solo pedimos los datos necesarios para cada función descrita; no solicitamos ni almacenamos datos que no ocupemos.</p>

      <h3>2. Para qué los usamos</h3>
      <ul>
        <li>Permitirte crear tickets, reservas y postulaciones.</li>
        <li>Que el dueño de un estacionamiento pueda cobrar y llevar su propio historial.</li>
        <li>Enviarte el enlace para recuperar tu contraseña, si lo pides.</li>
        <li>Prevenir fraude (por ejemplo, reservas falsas) y mantener la seguridad de la plataforma.</li>
        <li>Cumplir obligaciones legales cuando corresponda.</li>
      </ul>
      <p>No usamos tus datos para publicidad ni los vendemos a terceros.</p>

      <h3>3. Con quién los compartimos</h3>
      <p>Algunos proveedores externos participan en partes puntuales del servicio, cada uno con la información mínima que su función requiere:</p>
      <ul>
        <li><strong>Transbank (Webpay Plus):</strong> procesa el micropago de $100 CLP de las reservas. Tu número de tarjeta va directo a Transbank; nunca pasa por nuestros servidores.</li>
        <li><strong>Render y Neon:</strong> alojan la aplicación y la base de datos.</li>
        <li><strong>Un proveedor de correo (SMTP):</strong> cuando esté activo, envía el correo de recuperación de contraseña a quien lo solicite.</li>
        <li><strong>OpenStreetMap:</strong> entrega las imágenes del mapa. Al cargarlas, tu navegador le revela tu dirección IP a ese servicio, como con cualquier mapa incrustado.</li>
      </ul>
      <p>No usamos Google Analytics, Meta Pixel ni ninguna herramienta de publicidad o rastreo. Más detalles de las cookies que sí usamos en nuestra <a href="/?legal=cookies">Política de Cookies</a>.</p>

      <h3>4. Cuánto tiempo guardamos tus datos</h3>
      <p>
        Mientras tu cuenta o la relación con la plataforma esté activa, y después por el tiempo que exija
        la ley o que sea razonable para resolver disputas o cumplir obligaciones tributarias. Un
        administrador puede eliminar una cuenta desde el panel; al hacerlo, el registro de auditoría
        que esa persona haya generado se conserva, pero sin vincularlo ya a su identidad.
      </p>

      <h3>5. Tus derechos</h3>
      <p>
        Puedes pedir acceder a tus datos, corregirlos, eliminarlos u oponerte a un uso específico
        (derechos ARCO). Desde el 1 de diciembre de 2026, la Ley 21.719 amplía esto a un derecho de
        portabilidad. Para ejercerlos, escríbenos a <strong>{CONTACTO_LEGAL}</strong>.
      </p>

      <h3>6. Seguridad</h3>
      <p>
        Toda la información viaja cifrada (HTTPS) entre tu navegador y nuestros servidores. Las
        contraseñas se guardan con una función de hash (bcrypt), nunca en texto plano. El acceso a
        funciones administrativas requiere iniciar sesión y respeta el rol de cada cuenta.
      </p>

      <h3>7. Menores de edad</h3>
      <p>Este servicio no está dirigido a menores de 18 años.</p>

      <h3>8. Cambios a esta política</h3>
      <p>Si actualizamos esta política, publicaremos la nueva versión aquí con la fecha correspondiente.</p>
    </article>
  );
}
