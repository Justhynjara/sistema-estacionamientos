import { useEffect, useRef, useState } from 'react';

const CLAVE = 'aviso_cookies_visto';

// No es un banner de "aceptar/rechazar": la única cookie que usamos (la sesión de dueños y
// administradores) es estrictamente necesaria y no exige consentimiento previo, hoy ni bajo la
// Ley 21.719 que entra en vigor en diciembre de 2026 (ver Política de Cookies). Esto es solo un
// aviso informativo que se puede cerrar, no un candado que bloquee usar el sitio.
//
// El "ya lo vi" se recuerda en localStorage: es una preferencia de este navegador, no un dato
// personal ni algo que necesite su propio consentimiento.
export default function CookieNotice() {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    try { setVisible(localStorage.getItem(CLAVE) !== '1'); }
    catch { setVisible(true); }
  }, []);

  // Publica el alto del aviso en --aviso-cookies: los botones flotantes (asistente, escanear) y las
  // pestañas fijas suben ese tanto mientras el aviso está abierto, en vez de quedar tapados.
  useEffect(() => {
    const raiz = document.documentElement;
    if (!visible || !ref.current || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => raiz.style.setProperty('--aviso-cookies', `${ref.current.offsetHeight + 16}px`));
    obs.observe(ref.current);
    return () => { obs.disconnect(); raiz.style.removeProperty('--aviso-cookies'); };
  }, [visible]);

  function cerrar() {
    setVisible(false);
    try { localStorage.setItem(CLAVE, '1'); } catch { /* modo privado u otra restricción: no pasa nada */ }
  }

  if (!visible) return null;
  return (
    <div ref={ref} className="cookie-notice" role="region" aria-label="Aviso de cookies">
      <p>
        Usamos una sola cookie, necesaria para mantener tu sesión iniciada si eres dueño de un
        estacionamiento o administrador. No usamos cookies de analítica ni de publicidad.{' '}
        <a href="/?legal=cookies">Más detalles</a>.
      </p>
      <button type="button" className="secondary" onClick={cerrar}>Entendido</button>
    </div>
  );
}
