import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';

export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );
  return { pageItems, page: safePage, setPage, totalPages };
}

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Paginación" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
      <button type="button" className="secondary small" onClick={() => onChange(page - 1)} disabled={page <= 1}><Icon name="arrowLeft" size={16} />Anterior</button>
      <span className="muted small">Página <span className="mono">{page}</span> de <span className="mono">{totalPages}</span></span>
      <button type="button" className="secondary small" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>Siguiente<Icon name="arrowRight" size={16} /></button>
    </nav>
  );
}
