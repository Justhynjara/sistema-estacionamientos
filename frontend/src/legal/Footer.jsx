export default function Footer() {
  return (
    <footer className="site-footer">
      <nav aria-label="Legal">
        <a href="/?legal=privacidad">Política de Privacidad</a>
        <a href="/?legal=terminos">Términos y Condiciones</a>
        <a href="/?legal=cookies">Política de Cookies</a>
      </nav>
      <p>© {new Date().getFullYear()} Sistema de Estacionamientos</p>
    </footer>
  );
}
