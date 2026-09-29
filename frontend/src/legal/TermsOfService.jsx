import { CONTACTO_LEGAL, NOMBRE_SITIO, ULTIMA_ACTUALIZACION } from './contenido.js';

export default function TermsOfService() {
  return (
    <article>
      <h2>Términos y Condiciones</h2>
      <p style={{ color: 'var(--text-muted)' }}>Última actualización: {ULTIMA_ACTUALIZACION}</p>

      <p>
        Al usar {NOMBRE_SITIO} aceptas estos términos. Si no estás de acuerdo con alguno, no uses
        el servicio. Este servicio es para personas de 18 años o más.
      </p>

      <h3>1. Qué es {NOMBRE_SITIO}</h3>
      <p>
        {NOMBRE_SITIO} es una plataforma tecnológica que conecta a quienes buscan estacionamiento con
        estacionamientos independientes registrados en el sistema. <strong>No somos dueños ni
        operadores de los estacionamientos</strong>: cada uno es administrado por su propio dueño
        ("Cliente" en estos términos), responsable de su local, de la custodia de los vehículos que
        recibe y de cumplir la normativa que le aplique como establecimiento.
      </p>

      <h3>2. Cuentas y roles</h3>
      <ul>
        <li><strong>Usuario:</strong> busca estacionamiento y puede reservar un cupo sin crear cuenta.</li>
        <li><strong>Cliente:</strong> dueño de uno o más estacionamientos; emite y cobra tickets, valida reservas.</li>
        <li><strong>Administrador:</strong> registra estacionamientos y usuarios, y supervisa el sistema.</li>
        <li><strong>Soporte:</strong> revisa las postulaciones de nuevos estacionamientos.</li>
      </ul>
      <p>
        Eres responsable de la confidencialidad de tu contraseña y de lo que ocurra con tu cuenta.
        Un administrador puede desactivar o eliminar una cuenta si detecta uso indebido del sistema
        (por ejemplo, reservas falsas repetidas o intentos de vulnerar la plataforma).
      </p>

      <h3>3. Reservas y el micropago de $100 CLP</h3>
      <p>
        Para reservar un cupo antes de llegar, se cobra un micropago de <strong>$100 CLP</strong> a
        través de Webpay Plus (Transbank), con el único fin de desincentivar reservas falsas. Al
        pagarlo:
      </p>
      <ul>
        <li>El cupo queda apartado por el tiempo que indique la reserva (10 minutos, salvo que el estacionamiento indique otro plazo).</li>
        <li>Si validas tu llegada dentro de ese plazo, el monto se descuenta del cobro final que te haga el estacionamiento al salir.</li>
        <li><strong>Si no llegas dentro del plazo, la reserva expira, el cupo se libera y el monto de $100 CLP no se reembolsa.</strong> Es el costo de haber apartado ese cupo, se use o no.</li>
      </ul>
      <p>Verificamos los pagos directamente con Transbank; nunca vemos ni almacenamos el número de tu tarjeta.</p>

      <h3>4. El cobro al salir del estacionamiento</h3>
      <p>
        El cobro por el tiempo estacionado (efectivo o tarjeta de débito/crédito) lo recibe
        <strong> directamente el dueño del estacionamiento</strong>, en su propio punto de venta, y no
        pasa por esta plataforma ni por Webpay. La tarifa (precio por minuto y valor base mínimo) la
        define cada estacionamiento y se muestra antes de emitir el ticket.
      </p>

      <h3>5. Postulación de nuevos estacionamientos</h3>
      <p>
        Si postulas tu estacionamiento, la información y fotos que envíes serán revisadas por
        nuestro equipo de soporte. Aceptar una postulación no garantiza continuidad indefinida en la
        plataforma: un administrador puede dar de baja un estacionamiento que incumpla estos
        términos o la ley.
      </p>

      <h3>6. Qué no puedes hacer</h3>
      <ul>
        <li>Usar datos falsos para crear reservas, cuentas o postulaciones.</li>
        <li>Intentar vulnerar la seguridad del sistema o acceder a cuentas ajenas.</li>
        <li>Usar la plataforma para fines distintos a buscar, reservar o administrar estacionamientos.</li>
      </ul>

      <h3>7. Disponibilidad del servicio</h3>
      <p>
        Mostramos la disponibilidad de cupos en tiempo real, pero no podemos garantizar que un cupo
        siga libre entre que lo ves y llegas al lugar (por eso existe la reserva con micropago para
        quien quiera asegurarlo). Tampoco garantizamos que la plataforma esté disponible sin
        interrupciones.
      </p>

      <h3>8. Responsabilidad</h3>
      <p>
        {NOMBRE_SITIO} responde por el funcionamiento de su propia plataforma tecnológica. No
        respondemos por el estado, seguridad o custodia de tu vehículo mientras está en un
        estacionamiento: eso es responsabilidad del dueño de ese local, igual que en cualquier
        estacionamiento que no use esta plataforma. Nada en estos términos limita los derechos que
        la Ley N.º 19.496 (Ley del Consumidor) te reconoce de forma irrenunciable.
      </p>

      <h3>9. Ley aplicable y reclamos</h3>
      <p>
        Estos términos se rigen por la ley chilena. Si tienes un reclamo como consumidor, puedes
        presentarlo ante el Juzgado de Policía Local que corresponda a tu domicilio o al nuestro,
        según prefieras, conforme a la Ley N.º 19.496, o contactarnos directamente a
        <strong> {CONTACTO_LEGAL}</strong>.
      </p>

      <h3>10. Cambios a estos términos</h3>
      <p>Si los actualizamos, publicaremos la nueva versión aquí con la fecha correspondiente.</p>

      <p>Más información sobre tus datos en nuestra <a href="/?legal=privacidad">Política de Privacidad</a> y nuestra <a href="/?legal=cookies">Política de Cookies</a>.</p>
    </article>
  );
}
