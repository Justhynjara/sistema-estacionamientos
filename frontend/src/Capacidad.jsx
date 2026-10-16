// Cupos libres como barra: su largo es la proporción exacta de cupos libres sobre el total, así
// "3 libres" en un local de 24 y "3 libres" en uno de 6 no se ven iguales.
export default function Capacidad({ libres, total }) {
  const lleno = libres <= 0;
  const pct = total > 0 ? Math.max(0, Math.min(100, (libres / total) * 100)) : 0;
  return (
    <div className={'capacidad' + (lleno ? ' lleno' : '')}>
      <div className="barra" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      <b>{lleno
        ? <>Lleno · <span className="num">{total}</span> cupos</>
        : <><span className="num">{libres}</span> libres de <span className="num">{total}</span></>}</b>
    </div>
  );
}
