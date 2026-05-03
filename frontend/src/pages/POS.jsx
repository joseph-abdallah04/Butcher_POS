import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useSession } from '../context/SessionContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { buildStockMap, formatQty, getOnHand } from '../utils/stock.js';

const PAYMENT_METHODS = ['Cash', 'Card', 'EFTPOS'];

export default function POS() {
  const { shop, staff } = useSession();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [promoId, setPromoId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const stockMap = useMemo(() => buildStockMap(inventory), [inventory]);

  const loadCatalog = useCallback(async () => {
    if (!shop?.id) return;
    setLoading(true);
    try {
      const [p, c, cu, pr, inv] = await Promise.all([
        api.get('/products'),
        api.get('/categories'),
        api.get('/customers'),
        api.get('/promotions', { active_only: true }),
        api.get('/inventory', { shop_id: shop.id }),
      ]);
      setProducts(p);
      setCategories(c);
      setCustomers(cu);
      setPromotions(pr);
      setInventory(inv);
    } catch (err) {
      toast.error(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [shop?.id]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeCategory !== null && p.category_id !== activeCategory) return false;
      if (search && !p.product_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, activeCategory, search]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price_at_sale) * Number(item.quantity), 0),
    [cart],
  );

  const discountPercent = useMemo(() => {
    const promo = promotions.find((p) => String(p.id) === String(promoId));
    return promo ? Number(promo.discount_percent) : 0;
  }, [promoId, promotions]);

  const discountAmount = subtotal * (discountPercent / 100);
  const total = Math.max(0, subtotal - discountAmount);

  const cartStockOk = useMemo(
    () =>
      cart.every(
        (item) => item.quantity <= getOnHand(stockMap, item.product_id),
      ),
    [cart, stockMap],
  );

  const addProduct = (product) => {
    const oh = getOnHand(stockMap, product.id);
    const existing = cart.find((p) => p.product_id === product.id);
    const nextQty = (existing?.quantity ?? 0) + 1;
    if (oh <= 0) {
      toast.error(`${product.product_name} has no recorded stock. Receive stock in Admin → Inventory first.`);
      return;
    }
    if (nextQty > oh) {
      toast.error(
        `Only ${formatQty(oh)} ${product.unit_measure || 'units'} available for ${product.product_name}.`,
      );
      return;
    }
    setCart((prev) => {
      const ex = prev.find((p) => p.product_id === product.id);
      if (ex) {
        return prev.map((p) =>
          p.product_id === product.id ? { ...p, quantity: p.quantity + 1 } : p,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.product_name,
          unit_measure: product.unit_measure,
          price_at_sale: Number(product.unit_price),
          quantity: 1,
          discount_applied: 0,
        },
      ];
    });
  };

  const updateQty = (productId, qty, productName, unitMeasure) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((p) => p.product_id !== productId));
      return;
    }
    const oh = getOnHand(stockMap, productId);
    const clamped = Math.min(qty, oh);
    if (qty > oh) {
      toast.error(
        `Only ${formatQty(oh)} ${unitMeasure || 'units'} available${productName ? ` for ${productName}` : ''}. Quantity capped.`,
      );
    }
    setCart((prev) =>
      prev.map((p) => (p.product_id === productId ? { ...p, quantity: clamped } : p)),
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((p) => p.product_id !== productId));
  };

  const submitSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (!cartStockOk) {
      toast.error('Reduce quantities to match stock on hand before completing the sale.');
      return;
    }
    setSubmitting(true);
    try {
      const perItemDiscount = discountPercent > 0
        ? cart.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price_at_sale: item.price_at_sale,
            discount_applied: Number(
              ((item.price_at_sale * item.quantity * discountPercent) / 100).toFixed(2),
            ),
          }))
        : cart.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price_at_sale: item.price_at_sale,
            discount_applied: 0,
          }));

      const payload = {
        shop_id: shop.id,
        staff_id: staff.id,
        customer_id: customerId ? Number(customerId) : null,
        promo_id: promoId ? Number(promoId) : null,
        payment_method: paymentMethod,
        items: perItemDiscount,
      };

      const result = await api.post('/sales', payload);
      toast.success(`Sale #${result.id} recorded - $${Number(result.total_amount).toFixed(2)}`);
      setCart([]);
      setCustomerId('');
      setPromoId('');
      setPaymentMethod('Cash');
      try {
        const inv = await api.get('/inventory', { shop_id: shop.id });
        setInventory(inv);
      } catch {
        /* sale succeeded; stock refresh is best-effort */
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-500">Loading POS...</div>;
  }

  return (
    <div className="flex h-full">
      <section className="flex-1 overflow-y-auto p-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Point of Sale</h1>
          <input
            className="input max-w-xs"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          <CategoryChip
            label="All"
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.name}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
            />
          ))}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="card text-center text-slate-500">No products match your filters.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map((p) => (
              <ProductTile
                key={p.id}
                product={p}
                onHand={getOnHand(stockMap, p.id)}
                onClick={() => addProduct(p)}
              />
            ))}
          </div>
        )}
      </section>

      <aside className="flex w-96 flex-col border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold">Cart</h2>
          <p className="text-xs text-slate-500">{cart.length} line(s)</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!cartStockOk && cart.length > 0 && (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Some lines exceed available stock. Lower quantities or remove lines to complete the sale.
            </div>
          )}
          {cart.length === 0 ? (
            <p className="text-sm text-slate-500">Tap a product tile to add it to the cart.</p>
          ) : (
            <ul className="space-y-2">
              {cart.map((item) => {
                const oh = getOnHand(stockMap, item.product_id);
                const over = item.quantity > oh;
                return (
                <li
                  key={item.product_id}
                  className={`rounded-md border p-3 ${over ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-xs text-slate-500">
                        ${item.price_at_sale.toFixed(2)} / {item.unit_measure || 'unit'}
                      </div>
                      <div className={`mt-1 text-xs ${over ? 'font-medium text-red-700' : 'text-slate-600'}`}>
                        Stock available: {formatQty(oh)} · In cart: {formatQty(item.quantity)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => removeFromCart(item.product_id)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-slate-200 px-2 py-1 text-sm font-bold"
                      onClick={() =>
                        updateQty(item.product_id, item.quantity - 1, item.product_name, item.unit_measure)
                      }
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max={oh}
                      className="input w-20 text-center"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQty(
                          item.product_id,
                          Number(e.target.value),
                          item.product_name,
                          item.unit_measure,
                        )
                      }
                    />
                    <button
                      type="button"
                      className="rounded-md bg-slate-200 px-2 py-1 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={item.quantity >= oh}
                      onClick={() =>
                        updateQty(item.product_id, item.quantity + 1, item.product_name, item.unit_measure)
                      }
                    >
                      +
                    </button>
                    <span className="ml-auto font-semibold">
                      ${(item.price_at_sale * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </li>
              );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-3 space-y-3">
          <div>
            <label className="label">Customer (optional)</label>
            <select
              className="input"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Walk-in</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name || ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Promotion (optional)</label>
            <select className="input" value={promoId} onChange={(e) => setPromoId(e.target.value)}>
              <option value="">No promotion</option>
              {promotions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.promo_name} ({Number(p.discount_percent).toFixed(2)}%)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Payment method</label>
            <div className="flex gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 rounded-md border px-2 py-2 text-sm font-medium ${
                    paymentMethod === method
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 border-t border-slate-200 pt-3 text-sm">
            <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
            {discountPercent > 0 && (
              <Row
                label={`Discount (${discountPercent}%)`}
                value={`-$${discountAmount.toFixed(2)}`}
              />
            )}
            <Row
              label="Total"
              value={`$${total.toFixed(2)}`}
              className="text-lg font-bold text-slate-900"
            />
          </div>

          <button
            type="button"
            className="btn-primary w-full text-base"
            onClick={submitSale}
            disabled={submitting || cart.length === 0 || !cartStockOk}
          >
            {submitting ? 'Recording...' : 'Complete Purchase'}
          </button>
        </div>
      </aside>
    </div>
  );
}

function CategoryChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1 text-sm font-medium transition ${
        active
          ? 'bg-brand-600 text-white'
          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function ProductTile({ product, onHand, onClick }) {
  const out = onHand <= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={out}
      title={
        out
          ? 'No stock on hand — receive stock in Admin → Inventory'
          : `${formatQty(onHand)} ${product.unit_measure || 'units'} available`
      }
      className={`group flex flex-col rounded-lg border bg-white p-3 text-left shadow-sm transition ${
        out
          ? 'cursor-not-allowed border-slate-200 opacity-60'
          : 'border-slate-200 hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md'
      }`}
    >
      <div className="flex h-20 items-center justify-center rounded-md bg-gradient-to-br from-brand-100 to-brand-200 text-2xl font-bold text-brand-700">
        {product.product_name.charAt(0).toUpperCase()}
      </div>
      <div className="mt-2 line-clamp-2 text-sm font-semibold">{product.product_name}</div>
      <div className="mt-auto pt-2 text-xs text-slate-500">
        {product.category_name || 'Uncategorised'}
      </div>
      <div className="mt-1 text-[11px] font-medium text-slate-600">
        {out ? (
          <span className="text-red-600">Out of stock</span>
        ) : (
          <span>In stock: {formatQty(onHand)}</span>
        )}
      </div>
      <div className="mt-1 text-base font-bold text-slate-900">
        ${Number(product.unit_price).toFixed(2)}
        {product.unit_measure ? <span className="text-xs text-slate-500"> / {product.unit_measure}</span> : null}
      </div>
    </button>
  );
}


function Row({ label, value, className = '' }) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
