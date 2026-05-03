import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useSession } from '../../context/SessionContext.jsx';
import { useToast } from '../../components/Toast.jsx';

export default function Inventory() {
  const { shop } = useSession();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    if (!shop?.id) return Promise.resolve();
    return Promise.all([
      api.get('/inventory', { shop_id: shop.id }),
      api.get('/products'),
    ])
      .then(([inv, prods]) => {
        setRows(inv);
        setProducts(prods);
      })
      .catch((err) => toast.error(err.message));
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [shop?.id]);

  const submitRestock = async (e) => {
    e.preventDefault();
    if (!productId || !qty || Number(qty) <= 0) {
      toast.error('Choose a product and a positive quantity.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/inventory/restock', {
        shop_id: shop.id,
        product_id: Number(productId),
        quantity: Number(qty),
      });
      toast.success('Stock updated');
      setQty('');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!shop) return <div className="p-6 text-slate-500">Select a shop first.</div>;
  if (loading) return <div className="p-6 text-slate-500">Loading inventory...</div>;

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">Inventory — {shop.shop_name}</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-600">
        Stock levels for this shop. Sales and wastage reduce quantities automatically; use Receive stock
        to record deliveries or positive adjustments.
      </p>

      <div className="card mb-8 max-w-xl">
        <h2 className="mb-3 text-lg font-semibold">Receive stock</h2>
        <form onSubmit={submitRestock} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block min-w-[200px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Product</span>
            <select
              className="input w-full"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Select…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block w-32">
            <span className="mb-1 block text-xs font-medium text-slate-600">Quantity</span>
            <input
              className="input w-full"
              type="number"
              min="0"
              step="0.001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Add to stock'}
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Current stock</h2>
        {rows.length === 0 ? (
          <p className="text-slate-500">
            No inventory rows yet for this shop. Record a delivery above, or complete a sale/wastage to
            create a stock record.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">Unit</th>
                <th className="py-2 pr-4">On hand</th>
                <th className="py-2">Last restock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{r.product_name}</td>
                  <td className="py-2 pr-4">{r.unit_measure ?? '—'}</td>
                  <td className="py-2 pr-4 font-medium">{Number(r.stock_level ?? 0).toFixed(3)}</td>
                  <td className="py-2 text-slate-600">
                    {r.last_restock_date
                      ? new Date(r.last_restock_date).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
