import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import Icon from './Icon.jsx';

// Lo que dice el video, para quien no puede verlo (WCAG 1.2.1: alternativa a un video sin audio).
// Si se vuelve a grabar el video, actualizar también public/video/como-funciona.vtt.
const TRANSCRIPCION = [
  'Busca estacionamiento sin registrarte: escribe tu destino, o déjalo vacío para ver lo más cercano.',
  'Compara los cupos en tiempo real, el horario y la tarifa de cada opción.',
  'Filtra solo los abiertos y los que tienen cupos.',
  'Elige cuánto tiempo te quedas para ver el costo estimado, y ordénalos por precio.',
  'Traza la ruta en el mapa o ábrela en Waze.',
  'Reserva tu cupo por $100 con Webpay; se descuentan de lo que pagas al salir.',
  'Al llegar recibes un ticket con QR: escanéalo para ver tu tiempo y cuánto llevas a pagar.',
  'Si administras un estacionamiento, entra con tu cuenta.',
  'Ves tus estacionamientos con su ocupación y horario.',
  'Ves los vehículos dentro y las reservas, con aviso cuando una está por vencer.',
  'Cobras por patente o escaneando el QR, en efectivo, débito o crédito.',
  'Revisas lo recaudado, la ocupación y las horas de más movimiento.'
];

const PASOS = [
  ['search', 'Busca', 'Escribe tu destino o déjalo vacío para ver lo que hay a tu alrededor. Sin registrarte.'],
  ['coin', 'Compara', 'Cupos en tiempo real, horario, tarifa y cuánto te costaría quedarte 1 a 4 horas.'],
  ['ticket', 'Reserva', 'Aparta tu cupo por $100 con Webpay. Se descuentan de lo que pagas al salir.'],
  ['camera', 'Escanea tu ticket', 'Con la cámara ves cuánto tiempo llevas y cuánto vas a pagar, minuto a minuto.']
];

const DISPOSITIVOS = [['android', 'Android', 'phone'], ['iphone', 'iPhone', 'phone'], ['computador', 'Computador', 'monitor']];

const INSTRUCCIONES = {
  android: {
    navegador: 'Chrome',
    pasos: [
      <>Abre esta página en <b>Chrome</b>.</>,
      <>Toca el menú <Icon name="dots" size={16} title="Menú" /> arriba a la derecha.</>,
      <>Elige <b>Instalar app</b> (o <b>Agregar a la pantalla principal</b>) y confirma.</>,
      <>Listo: la encuentras en tu pantalla de inicio como <b>Estacionamientos</b>.</>
    ]
  },
  iphone: {
    navegador: 'Safari',
    pasos: [
      <>Abre esta página en <b>Safari</b>.</>,
      <>Toca <b>Compartir</b> <Icon name="share" size={16} title="Compartir" /> en la barra de abajo.</>,
      <>Baja y elige <b>Agregar a pantalla de inicio</b>, y luego <b>Agregar</b>.</>,
      <>Listo: se abre a pantalla completa desde el ícono <b>Estacionamientos</b>.</>
    ]
  },
  computador: {
    navegador: 'Chrome o Edge',
    pasos: [
      <>Abre esta página en <b>Chrome</b> o <b>Edge</b>.</>,
      <>Haz clic en el ícono de instalar al final de la barra de direcciones, o en el menú elige <b>Instalar Sistema de Estacionamientos</b>.</>,
      <>Confirma con <b>Instalar</b>: queda en el escritorio y en el menú de inicio.</>
    ]
  }
};

function dispositivoActual() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iphone';
  if (/Android/i.test(ua)) return 'android';
  return 'computador';
}

// Abierta desde el ícono de la pantalla de inicio (PWA instalada) o como app nativa (Capacitor).
const abiertaComoApp = () =>
  Capacitor.isNativePlatform()
  || window.matchMedia?.('(display-mode: standalone)').matches
  || window.matchMedia?.('(display-mode: fullscreen)').matches
  || window.navigator.standalone === true;

// Sección al pie de la portada: el video de la app en uso, los pasos y cómo instalarla.
// Quien ya abre la app instalada no la ve: ya sabe cómo funciona y ya la tiene.
export default function ComoFunciona() {
  const [dispositivo, setDispositivo] = useState(dispositivoActual);
  const [aviso, setAviso] = useState(null); // evento beforeinstallprompt (Chrome/Edge)
  const [instalada, setInstalada] = useState(false);
  const [comoApp] = useState(abiertaComoApp);

  useEffect(() => {
    const guardar = e => { e.preventDefault(); setAviso(e); };
    const listo = () => { setInstalada(true); setAviso(null); };
    window.addEventListener('beforeinstallprompt', guardar);
    window.addEventListener('appinstalled', listo);
    return () => { window.removeEventListener('beforeinstallprompt', guardar); window.removeEventListener('appinstalled', listo); };
  }, []);

  async function instalar() {
    aviso.prompt();
    const { outcome } = await aviso.userChoice;
    if (outcome === 'accepted') setInstalada(true);
    setAviso(null);
  }

  if (comoApp) return null;
  const inst = INSTRUCCIONES[dispositivo];

  return (
    <section className="como-funciona" id="como-funciona" aria-labelledby="como-funciona-titulo">
      <div className="inner">
        <header className="cf-cabecera">
          <p className="cf-eyebrow">Cómo funciona</p>
          <h2 id="como-funciona-titulo">Del destino al cupo, en cuatro pasos</h2>
        </header>
        <div className="cf-video">
          <div className="cf-telefono">
            <video
              controls
              playsInline
              preload="none"
              poster="/video/como-funciona.jpg"
              width="390"
              height="844"
              aria-label="Video: cómo se usa la app, de la búsqueda al cobro (1 minuto y 14 segundos, sin audio, con subtítulos en pantalla)"
            >
              <source src="/video/como-funciona.mp4" type="video/mp4" />
              <track kind="descriptions" src="/video/como-funciona.vtt" srcLang="es" label="Español" />
            </video>
          </div>
          <details className="cf-transcripcion">
            <summary>Leer lo que muestra el video</summary>
            <ol>{TRANSCRIPCION.map(t => <li key={t}>{t}</li>)}</ol>
          </details>
        </div>

        <div className="cf-texto">
          <ol className="cf-pasos">
            {PASOS.map(([icono, titulo, texto], i) => (
              <li key={titulo}>
                <span className="cf-num" aria-hidden="true">{i + 1}</span>
                <div>
                  <h3><Icon name={icono} size={18} />{titulo}</h3>
                  <p>{texto}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="cf-duenos">
            <b>¿Eres dueño?</b> Emite y cobra tickets con QR desde tu teléfono, valida reservas y revisa lo recaudado,
            la ocupación y las horas de más movimiento.
          </p>

          <div className="cf-instalar" aria-labelledby="cf-instalar-titulo">
            <h3 id="cf-instalar-titulo">Instálala en tu dispositivo</h3>
            {instalada ? (
              <p className="badge ok">Ya la tienes instalada: ábrela desde el ícono Estacionamientos.</p>
            ) : (
              <>
                <p className="muted small" style={{ margin: 0 }}>
                  No necesitas tienda de aplicaciones: se instala desde el navegador, ocupa casi nada y se actualiza sola.
                </p>
                {aviso && (
                  <button type="button" onClick={instalar}><Icon name="download" size={17} />Instalar app ahora</button>
                )}
                <div className="segmentos" role="radiogroup" aria-label="Tu dispositivo">
                  {DISPOSITIVOS.map(([k, texto, icono]) => (
                    <button key={k} type="button" role="radio" className="filtro" aria-checked={dispositivo === k} onClick={() => setDispositivo(k)}>
                      <Icon name={icono} size={15} />{texto}
                    </button>
                  ))}
                </div>
                <ol className="cf-instrucciones" aria-label={`Instalar en ${DISPOSITIVOS.find(d => d[0] === dispositivo)[1]} con ${inst.navegador}`}>
                  {inst.pasos.map((p, i) => <li key={i}>{p}</li>)}
                </ol>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
