import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useSession } from '../context/SessionContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { buildStockMap, formatQty, getOnHand } from '../utils/stock.js';

const REASONS = ['Expired', 'Fridge Failure', 'Spoiled', 'Damaged', 'Cross-Contamination', 'Other'];

export default function Wastage() {
  const { shop, staff } = useSession();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [recent, setRecent] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [submitting, setSubmitting] = useState(false);

  const stockMap = useMemo(() => buildStockMap(inventory), [inventory]);

  const selectedOnHand = productId
    ? getOnHand(stockMap, Number(productId))
    : null;

  const qtyNum = quantity === '' ? NaN : Number(quantity);
  const qtyValid = !Number.isNaN(qtyNum) && qtyNum > 0;
  const withinStock =
    selectedOnHand !== null && qtyValid && qtyNum <= selectedOnHand && selectedOnHand > 0;
  const canSubmit =
    Boolean(productId) && withinStock && !submitting;

  const reload = useCallback(() => {
    if (!shop?.id) return;
    Promise.all([
      api.get('/wastage', { shop_id: shop.id, limit: 20 }),
      api.get('/inventory', { shop_id: shop.id }),
    ])
      .then(([w, inv]) => {
        setRecent(w);
        setInventory(inv);
      })
      .catch(() => {});
  }, [shop?.id]);

  useEffect(() => {
    if (!shop?.id) return;
    Promise.all([
      api.get('/products'),
      api.get('/inventory', { shop_id: shop.id }),
      api.get('/wastage', { shop_id: shop.id, limit: 20 }),
    ])
      .then(([p, inv, w]) => {
        setProducts(p);
        setInventory(inv);
        setRecent(w);
      })
      .catch((err) => toast.error(err.message));
  }, [shop?.id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!productId) {
      toast.error('Pick a product');
      return;
    }
    if (!qtyValid || qtyNum > selectedOnHand) {
      toast.error(
        selectedOnHand <= 0
          ? 'No stock on hand for this product. Receive stock first.'
          : `You can log at most ${formatQty(selectedOnHand)} for this product.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/wastage', {
        shop_id: shop.id,
        staff_id: staff.id,
        product_id: Number(productId),
        quantity_wasted: qtyNum,
        reason,
      });
      toast.success('Wastage logged');
      setProductId('');
      setQuantity('');
      setReason(REASONS[0]);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onProductChange = (e) => {
    setProductId(e.target.value);
    setQuantity('');
  };

  const maxQty = selectedOnHand ?? 0;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-bold">Log Wastage</h1>
      <p className="mb-6 text-sm text-slate-500">
        Record stock that had to be thrown out so the warehouse can track shrinkage. You cannot log more than
        is on hand for this shop.
      </p>

      <form className="card grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <div className="sm:col-span-2">
          <label className="label">Product</label>
          <select className="input" value={productId} onChange={onProductChange} required>
            <option value="">Choose a product...</option>
            {products.map((p) => {
              const oh = getOnHand(stockMap, p.id);
              return (
                <option key={p.id} value={p.id}>
                  {p.product_name} — {formatQty(oh)} {p.unit_measure || 'units'} on hand
                </option>
              );
            })}
          </select>
        </div>
        {productId && (
          <div className="sm:col-span-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Stock at this shop:</span>{' '}
            {selectedOnHand !== null && selectedOnHand > 0 ? (
              <>
                {formatQty(selectedOnHand)}{' '}
                {products.find((p) => p.id === Number(productId))?.unit_measure || 'units'} available to waste.
              </>
            ) : (
              <span className="text-red-700">
                No recorded stock — receive stock under Admin → Inventory before logging wastage.
              </span>
            )}
          </div>
        )}
        <div>
          <label className="label">Quantity wasted</label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            max={maxQty > 0 ? maxQty : undefined}
            className={`input ${qtyValid && selectedOnHand !== null && qtyNum > selectedOnHand ? 'border-red-400' : ''}`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={!productId || selectedOnHand <= 0}
          />
          {productId && qtyValid && qtyNum > selectedOnHand && (
            <p className="mt-1 text-xs font-medium text-red-600">
              Cannot exceed {formatQty(selectedOnHand)} on hand.
            </p>
          )}
        </div>
        <div>
          <label className="label">Reason</label>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {submitting ? 'Logging...' : 'Log wastage'}
          </button>
        </div>
      </form>

      <h2 className="mt-8 mb-2 text-lg font-semibold">Recent wastage at this shop</h2>
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Quantity</th>
              <th className="px-4 py-2">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {recent.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-slate-500" colSpan={4}>
                  No wastage logged yet for this shop.
                </td>
              </tr>
            )}
            {recent.map((w) => {
              const product = products.find((p) => p.id === w.product_id);
              return (
                <tr key={w.id}>
                  <td className="px-4 py-2">
                    {w.created_at ? new Date(w.created_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-2">{product?.product_name || `#${w.product_id}`}</td>
                  <td className="px-4 py-2">{Number(w.quantity_wasted).toFixed(3)}</td>
                  <td className="px-4 py-2">{w.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
