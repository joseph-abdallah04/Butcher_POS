import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useSession } from '../context/SessionContext.jsx';
import { useToast } from './Toast.jsx';
import Modal from './Modal.jsx';

export default function ShopLockGate({ children }) {
  const { shop, staff, isLocked, setShop, setStaff } = useSession();

  if (isLocked) return children;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 via-brand-800 to-slate-900 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Butchery POS</h1>
        <p className="mb-6 text-sm text-slate-500">
          Pick a shop and a staff member to start a session.
        </p>
        {!shop ? <ShopStep onPick={setShop} /> : <StaffStep shop={shop} onPick={setStaff} onBack={() => setShop(null)} />}
      </div>
    </div>
  );
}

function ShopStep({ onPick }) {
  const toast = useToast();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const reload = () => {
    setLoading(true);
    api.get('/shops')
      .then(setShops)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  return (
    <div>
      <label className="label">Select your shop</label>
      <select
        className="input"
        defaultValue=""
        disabled={loading}
        onChange={(e) => {
          const id = Number(e.target.value);
          const picked = shops.find((s) => s.id === id);
          if (picked) onPick(picked);
        }}
      >
        <option value="" disabled>
          {loading ? 'Loading...' : 'Choose a shop'}
        </option>
        {shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.shop_name} ({s.shop_code})
          </option>
        ))}
      </select>
      <div className="mt-4 flex justify-between">
        <button type="button" className="btn-secondary" onClick={reload}>
          Refresh
        </button>
        <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
          + Create new shop
        </button>
      </div>
      <CreateShopModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(shop) => {
          setShowCreate(false);
          toast.success(`Shop "${shop.shop_name}" created`);
          reload();
        }}
      />
    </div>
  );
}

function StaffStep({ shop, onPick, onBack }) {
  const toast = useToast();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/shops/${shop.id}/staff`)
      .then(setStaff)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [shop.id]);

  return (
    <div>
      <p className="mb-2 text-sm text-slate-700">
        Shop: <span className="font-semibold">{shop.shop_name}</span>
      </p>
      <label className="label">Who is on shift?</label>
      {loading ? (
        <p className="text-sm text-slate-500">Loading staff...</p>
      ) : staff.length === 0 ? (
        <p className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
          No staff for this shop yet. Add one in Admin -&gt; Staff after picking a temporary shop, or
          insert directly in the database.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {staff.map((s) => (
            <button
              key={s.id}
              type="button"
              className="rounded-md border border-slate-200 bg-slate-50 p-3 text-left hover:border-brand-500 hover:bg-brand-50"
              onClick={() => onPick(s)}
            >
              <div className="font-medium">{s.staff_name}</div>
              {s.role && <div className="text-xs text-slate-500">{s.role}</div>}
            </button>
          ))}
        </div>
      )}
      <div className="mt-4">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back to shops
        </button>
      </div>
    </div>
  );
}

function CreateShopModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ shop_name: '', location: '', shop_code: '' });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await api.post('/shops', form);
      onCreated(created);
      setForm({ shop_name: '', location: '', shop_code: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a new shop"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="create-shop-form" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create shop'}
          </button>
        </>
      }
    >
      <form id="create-shop-form" className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label">Shop name</label>
          <input
            className="input"
            value={form.shop_name}
            onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Location</label>
          <input
            className="input"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Shop code (unique)</label>
          <input
            className="input"
            value={form.shop_code}
            onChange={(e) => setForm({ ...form, shop_code: e.target.value })}
            required
          />
        </div>
      </form>
    </Modal>
  );
}
