import { SignE } from '../Icon.jsx';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="inner">
        <p className="brand"><SignE size={24} />© {new Date().getFullYear()} Estacionados · Chile</p>
        {/* Se abren en otra pestaña: así leerlas no borra lo que la persona tenga a medio escribir. */}
        <nav aria-label="Legal">
          <a href="/?legal=privacidad" target="_blank" rel="noopener">Política de Privacidad</a>
          <a href="/?legal=terminos" target="_blank" rel="noopener">Términos y Condiciones</a>
          <a href="/?legal=cookies" target="_blank" rel="noopener">Política de Cookies</a>
        </nav>
      </div>
    </footer>
  );
}
