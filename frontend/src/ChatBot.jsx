import { useEffect, useRef, useState } from 'react';

const FAQ = [
  {
    pregunta: '¿Cómo busco un estacionamiento?',
    keywords: ['buscar', 'busco', 'encontrar', 'cerca', 'cupo', 'disponible', 'mapa'],
    respuesta: 'Escribe tu ubicación de partida (o usa tu GPS) y tu destino, luego presiona "Buscar estacionamientos". Verás los estacionamientos cercanos con cupos disponibles, distancia y precio por hora.'
  },
  {
    pregunta: '¿Cómo reservo un cupo?',
    keywords: ['reservar', 'reserva', 'cupo', 'apartar'],
    respuesta: 'En la tarjeta del estacionamiento presiona "Reservar cupo", ingresa la patente de tu vehículo y confirma. Se te pedirá un micropago de $100 CLP por Webpay para validar que la reserva es real — una vez aprobado, tu reserva queda activa por 10 minutos.'
  },
  {
    pregunta: '¿Por qué me cobran $100 al reservar?',
    keywords: ['micropago', '100', 'cobro', 'cobran', 'por que', 'porqué', 'reserva pagada', 'pago reserva'],
    respuesta: 'Es un micropago mínimo de $100 CLP para evitar reservas falsas que ocupen cupos sin intención real de llegar. Si validas tu reserva a tiempo, el cupo queda para ti; si no llegas dentro de los 10 minutos, la reserva se libera automáticamente.'
  },
  {
    pregunta: '¿Cuánto dura mi reserva?',
    keywords: ['duracion', 'dura', 'minutos', 'expira', 'vence', 'tiempo reserva'],
    respuesta: 'Las reservas duran 10 minutos desde que se confirma el pago. Si no validas tu llegada dentro de ese tiempo, el cupo se libera automáticamente para otros usuarios.'
  },
  {
    pregunta: '¿Cómo pago al salir del estacionamiento?',
    keywords: ['pagar', 'pago', 'salir', 'cobro', 'efectivo', 'tarjeta', 'webpay', 'cuanto cuesta'],
    respuesta: 'Al salir, el encargado del estacionamiento puede cobrarte en efectivo (te calculará el vuelto) o con tarjeta vía Webpay. El monto se calcula según las horas que estuviste dentro y el precio por hora del lugar.'
  },
  {
    pregunta: '¿Cómo descargo o imprimo mi ticket/comprobante?',
    keywords: ['descargar', 'imprimir', 'comprobante', 'ticket', 'qr'],
    respuesta: 'En la pantalla de tu ticket o reserva confirmada verás los botones "⬇️ Descargar QR" e "🖨️ Imprimir". Puedes guardar el código QR como imagen o imprimir el comprobante desde el navegador.'
  },
  {
    pregunta: 'Olvidé mi contraseña',
    keywords: ['contraseña', 'clave', 'password', 'olvide', 'olvidé', 'recuperar'],
    respuesta: 'Si eres dueño de un estacionamiento o administrador, en la pantalla de inicio de sesión presiona "¿Olvidaste tu contraseña?" e ingresa tu email — te enviaremos un enlace para definir una nueva.'
  },
  {
    id: 'ser_cliente',
    pregunta: '¿Quieres ser cliente?',
    keywords: ['registrar', 'dueño', 'dueno', 'ser cliente', 'quiero ser cliente', 'agregar estacionamiento', 'publicar mi estacionamiento', 'sumar mi estacionamiento'],
    respuesta: 'Puedes postular tu estacionamiento para sumarlo al sistema. Nuestro equipo de soporte revisará tus datos y fotos para validar que cumple los requisitos; si es aprobado, un administrador te creará un usuario y correo de acceso, y luego un equipo coordinará contigo la instalación y configuración en terreno.'
  },
  {
    pregunta: '¿Necesito crear una cuenta para reservar?',
    keywords: ['cuenta', 'registro', 'registrarme', 'crear usuario', 'necesito iniciar sesion'],
    respuesta: 'No. Buscar y reservar un cupo no requiere cuenta ni inicio de sesión — solo necesitas tu ubicación, destino y la patente de tu vehículo. Solo los dueños de estacionamientos y administradores necesitan iniciar sesión.'
  }
];

const SALUDO = { rol: 'bot', texto: '¡Hola! 👋 Soy el asistente del Sistema de Estacionamientos. Puedes preguntarme sobre cómo buscar, reservar o pagar un estacionamiento.' };
const FALLBACK = 'No tengo una respuesta exacta para eso. Prueba con alguna de las preguntas frecuentes de abajo, o si es algo puntual de tu reserva, contacta directamente al estacionamiento con tu código de comprobante.';

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function buscarMejorMatch(texto) {
  const t = normalizar(texto);
  let mejor = null, mejorScore = 0;
  for (const item of FAQ) {
    let score = 0;
    for (const kw of item.keywords) {
      if (t.includes(normalizar(kw))) score++;
    }
    if (score > mejorScore) { mejorScore = score; mejor = item; }
  }
  return mejor;
}

export default function ChatBot({ onAbrirSolicitud }) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([SALUDO]);
  const [texto, setTexto] = useState('');
  const finRef = useRef(null);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, abierto]);

  function enviar(pregunta) {
    const p = (pregunta ?? texto).trim();
    if (!p) return;
    const match = buscarMejorMatch(p);
    const botMsg = match
      ? { rol: 'bot', texto: match.respuesta, accion: match.id === 'ser_cliente' ? 'ser_cliente' : null }
      : { rol: 'bot', texto: FALLBACK };
    setMensajes(m => [...m, { rol: 'user', texto: p }, botMsg]);
    setTexto('');
  }

  function onSubmit(e) {
    e.preventDefault();
    enviar();
  }

  return (
    <>
      <button
        type="button"
        className="chatbot-toggle"
        onClick={() => setAbierto(a => !a)}
        aria-label={abierto ? 'Cerrar asistente' : 'Abrir asistente'}
        title="¿Dudas? Pregúntale al asistente"
      >
        {abierto ? '✕' : '💬'}
      </button>

      {abierto && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <span>🤖 Asistente</span>
            <button type="button" onClick={() => setAbierto(false)}>Cerrar</button>
          </div>
          <div className="chatbot-messages">
            {mensajes.map((m, i) => (
              <div key={i}>
                <div className={'chatbot-msg ' + m.rol}>{m.texto}</div>
                {m.accion === 'ser_cliente' && (
                  <button type="button" style={{ marginTop: 6 }} onClick={onAbrirSolicitud}>📋 Completar solicitud</button>
                )}
              </div>
            ))}
            <div ref={finRef} />
          </div>
          <div className="chatbot-suggestions">
            <button type="button" onClick={() => enviar('¿Quieres ser cliente?')}>🏢 ¿Quieres ser cliente?</button>
            {FAQ.filter(f => f.id !== 'ser_cliente').slice(0, 3).map((f, i) => (
              <button key={i} type="button" onClick={() => enviar(f.pregunta)}>{f.pregunta}</button>
            ))}
          </div>
          <form className="chatbot-input" onSubmit={onSubmit}>
            <input
              placeholder="Escribe tu pregunta..."
              aria-label="Escribe tu pregunta"
              value={texto}
              onChange={e => setTexto(e.target.value)}
            />
            <button type="submit">Enviar</button>
          </form>
        </div>
      )}
    </>
  );
}
