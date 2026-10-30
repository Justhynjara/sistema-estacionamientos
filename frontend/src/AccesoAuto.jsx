// El auto que vigila el acceso: asoma sobre la tarjeta y reacciona a lo que se escribe.
// - 'reposo': focos encendidos, parpadea de vez en cuando.
// - 'mira': los focos siguen el texto del email (de izquierda a derecha según el largo).
// - 'tapa': escribiendo la contraseña, apaga los focos (no mira tu clave).
// - 'espia': con la contraseña visible, los abre a medias.
// - 'pasa': acceso correcto, la barrera sube y el auto entra.
// Es decorativo: va oculto para lectores de pantalla.
export default function AccesoAuto({ modo = 'reposo', avance = 0 }) {
  const r = Math.max(0, Math.min(1, avance));
  const estilo = modo === 'mira' ? { '--mx': `${(-5 + 10 * r).toFixed(1)}px`, '--my': '4px' } : undefined;
  const foco = x => (
    <g className="foco" transform={`translate(${x} 70)`}>
      <circle className="aro" r="15" />
      <g className="pupila"><circle r="7" /><circle className="brillo" cx="-2.5" cy="-2.5" r="2.2" /></g>
      <g clipPath="url(#acceso-foco)"><rect className="parpado" x="-16" y="-16" width="32" height="32" /></g>
    </g>
  );
  return (
    <div className={`acceso-auto ${modo}`} style={estilo} aria-hidden="true">
      <svg viewBox="0 0 200 124" focusable="false">
        <defs><clipPath id="acceso-foco"><circle r="15" /></clipPath></defs>
        <g className="auto">
          <rect className="carro" x="44" y="40" width="16" height="9" rx="4" />
          <rect className="carro" x="140" y="40" width="16" height="9" rx="4" />
          <path className="carro" d="M58 54 L70 18 Q72 12 80 12 H120 Q128 12 130 18 L142 54 Z" />
          <path className="vidrio-auto" d="M69 50 L78 22 Q79 19 83 19 H117 Q121 19 122 22 L131 50 Z" />
          <path className="reflejo" d="M84 24 L76 46" />
          <rect className="carro" x="22" y="48" width="156" height="64" rx="20" />
          <rect className="parrilla" x="76" y="78" width="48" height="13" rx="6.5" />
          <rect className="patente" x="81" y="97" width="38" height="11" rx="2" />
          <text className="patente-txt" x="100" y="105.5">EST·26</text>
          {foco(52)}
          {foco(148)}
        </g>
        <g className="barrera">
          <rect className="poste" x="4" y="92" width="10" height="30" rx="3" />
          <g className="brazo">
            <rect className="brazo-base" x="9" y="97" width="186" height="8" rx="4" />
            {[30, 62, 94, 126, 158].map(x => <rect key={x} className="franja" x={x} y="97" width="14" height="8" />)}
          </g>
          <circle className="eje" cx="9" cy="101" r="5" />
        </g>
      </svg>
    </div>
  );
}
