/** Helpers for client-side stock checks (server still enforces truth). */

export function buildStockMap(inventoryRows) {
  const m = new Map();
  for (const row of inventoryRows) {
    m.set(row.product_id, Number(row.stock_level ?? 0));
  }
  return m;
}

export function getOnHand(stockMap, productId) {
  return stockMap.get(productId) ?? 0;
}

/** Readable quantity for UI labels (trims trailing zeros). */
export function formatQty(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return '0';
  return Number(x.toFixed(3)).toString();
}
