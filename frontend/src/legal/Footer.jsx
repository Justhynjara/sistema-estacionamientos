import { SignE } from '../Icon.jsx';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="inner">
        <p className="brand"><SignE size={24} />© {new Date().getFullYear()} Estacionados · Chile</p>
        <nav aria-label="Legal">
          <a href="/?legal=privacidad">Política de Privacidad</a>
          <a href="/?legal=terminos">Términos y Condiciones</a>
          <a href="/?legal=cookies">Política de Cookies</a>
        </nav>
      </div>
    </footer>
  );
}
