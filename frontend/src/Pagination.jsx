import { useMemo, useState } from 'react';

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
      <button type="button" className="secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>← Anterior</button>
      <span style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>Página {page} de {totalPages}</span>
      <button type="button" className="secondary" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>Siguiente →</button>
    </div>
  );
}
