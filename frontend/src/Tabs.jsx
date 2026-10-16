import Icon from './Icon.jsx';

// Pestañas de los paneles internos: [clave, etiqueta, ícono].
export default function Tabs({ tabs, tab, setTab, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map(([k, texto, icono]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={tab === k}
          className={'tab' + (tab === k ? ' active' : '')}
          onClick={() => setTab(k)}
        >
          {icono && <Icon name={icono} size={17} />}{texto}
        </button>
      ))}
    </div>
  );
}
