import PrivacyPolicy from './PrivacyPolicy.jsx';
import TermsOfService from './TermsOfService.jsx';
import CookiePolicy from './CookiePolicy.jsx';

const PAGINAS = { privacidad: PrivacyPolicy, terminos: TermsOfService, cookies: CookiePolicy };

// Igual que el resto de App.jsx (?ticket=, ?reset=): la página legal a mostrar viaja en la URL
// (?legal=privacidad|terminos|cookies), así se puede enlazar y compartir directamente.
export default function LegalPage({ pagina, onVolver }) {
  const Contenido = PAGINAS[pagina] || PrivacyPolicy;
  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <button type="button" className="secondary" onClick={onVolver} style={{ marginBottom: 8 }}>← Volver</button>
      <div className="card" style={{ lineHeight: 1.6 }}>
        <Contenido />
      </div>
    </main>
  );
}
