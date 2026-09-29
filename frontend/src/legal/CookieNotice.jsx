import { useEffect, useState } from 'react';

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

  useEffect(() => {
    try { setVisible(localStorage.getItem(CLAVE) !== '1'); }
    catch { setVisible(true); }
  }, []);

  function cerrar() {
    setVisible(false);
    try { localStorage.setItem(CLAVE, '1'); } catch { /* modo privado u otra restricción: no pasa nada */ }
  }

  if (!visible) return null;
  return (
    <div className="cookie-notice" role="region" aria-label="Aviso de cookies">
      <p>
        Usamos una sola cookie, necesaria para mantener tu sesión iniciada si eres dueño de un
        estacionamiento o administrador. No usamos cookies de analítica ni de publicidad.{' '}
        <a href="/?legal=cookies">Más detalles</a>.
      </p>
      <button type="button" className="secondary" onClick={cerrar}>Entendido</button>
    </div>
  );
}
