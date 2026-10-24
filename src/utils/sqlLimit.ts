/** Entero seguro para interpolar LIMIT/OFFSET (evita ER_WRONG_ARGUMENTS con placeholders en mysql2). */
export function clampSqlLimit(value: unknown, fallback = 20, max = 500): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(n)));
}

export function clampSqlOffset(page: unknown, limit: number, fallbackPage = 1): number {
  const p = typeof page === 'number' ? page : parseInt(String(page ?? ''), 10);
  const pageNum = Number.isFinite(p) && p >= 1 ? Math.trunc(p) : fallbackPage;
  return (pageNum - 1) * limit;
}
