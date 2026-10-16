import PrivacyPolicy from './PrivacyPolicy.jsx';
import TermsOfService from './TermsOfService.jsx';
import CookiePolicy from './CookiePolicy.jsx';
import Icon from '../Icon.jsx';

const PAGINAS = { privacidad: PrivacyPolicy, terminos: TermsOfService, cookies: CookiePolicy };

// Igual que el resto de App.jsx (?ticket=, ?reset=): la página legal a mostrar viaja en la URL
// (?legal=privacidad|terminos|cookies), así se puede enlazar y compartir directamente.
export default function LegalPage({ pagina, onVolver }) {
  const Contenido = PAGINAS[pagina] || PrivacyPolicy;
  return (
    <>
      <button type="button" className="link-button" onClick={onVolver}><Icon name="arrowLeft" size={16} />Volver</button>
      <div className="card">
        <Contenido />
      </div>
    </>
  );
}
