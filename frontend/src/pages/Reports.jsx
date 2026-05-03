import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api.js';
import { useSession } from '../context/SessionContext.jsx';
import { useToast } from '../components/Toast.jsx';

const PALETTE = ['#c92a2a', '#e8590c', '#f08c00', '#5c940d', '#2b8a3e', '#1971c2', '#5f3dc4', '#a61e4d'];

const isoDate = (d) => d.toISOString().slice(0, 10);
const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(v ?? 0);
const fmtNumber = (v) => new Intl.NumberFormat('en-AU').format(v ?? 0);
const fmtPercent = (v) => `${((v ?? 0) * 100).toFixed(1)}%`;

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Reports() {
  const { shop } = useSession();
  const toast = useToast();

  const [phase, setPhase] = useState('etl'); // 'etl' | 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);
  const [etlResponse, setEtlResponse] = useState(null);

  const [endDate, setEndDate] = useState(isoDate(new Date()));
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return isoDate(d);
  });

  const [allShops, setAllShops] = useState([]);
  const [reportScope, setReportScope] = useState('current');
  const [locationShopId, setLocationShopId] = useState(shop.id);
  const booted = useRef(false);

  const [data, setData] = useState({
    kpis: null,
    revenueTrend: [],
    salesVelocity: [],
    topProducts: [],
    categoryMix: [],
    wastage: { by_reason: [], by_product: [] },
    staff: [],
    promo: [],
  });

  const effectiveShopId = useMemo(() => {
    if (reportScope === 'all') return null;
    if (reportScope === 'current') return shop.id;
    return locationShopId;
  }, [reportScope, shop.id, locationShopId]);

  const reportTitle = useMemo(() => {
    if (reportScope === 'all') return 'Franchise (all locations)';
    if (reportScope === 'current') return shop.shop_name;
    const picked = allShops.find((s) => s.id === locationShopId);
    return picked ? picked.shop_name : 'Selected location';
  }, [reportScope, shop.shop_name, allShops, locationShopId]);

  function buildReportQuery(start, end, shopId) {
    const q = { start_date: start, end_date: end };
    if (shopId != null) q.shop_id = shopId;
    return q;
  }

  async function loadReportsWithQuery(start, end, shopId) {
    setPhase('loading');
    try {
      const query = buildReportQuery(start, end, shopId);
      const [kpis, revenueTrend, salesVelocity, topProducts, categoryMix, wastage, staff, promo] =
        await Promise.all([
          api.get('/reports/kpis', query),
          api.get('/reports/revenue-trend', query),
          api.get('/reports/sales-velocity', query),
          api.get('/reports/top-products', { ...query, limit: 10 }),
          api.get('/reports/category-mix', query),
          api.get('/reports/wastage-summary', query),
          api.get('/reports/staff-performance', query),
          api.get('/reports/promo-roi', query),
        ]);
      setData({ kpis, revenueTrend, salesVelocity, topProducts, categoryMix, wastage, staff, promo });
      setPhase('ready');
    } catch (err) {
      setErrorMessage(err.message);
      setPhase('error');
      toast.error(err.message);
    }
  }

  // 1) On first mount, run ETL, load the shop list, then fetch (default: current shop)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase('etl');
      try {
        const [res, shops] = await Promise.all([api.post('/etl/sync'), api.get('/shops')]);
        if (cancelled) return;
        setEtlResponse(res);
        setAllShops(shops);
        setLocationShopId(shop.id);
        setReportScope('current');
        await loadReportsWithQuery(startDate, endDate, shop.id);
        booted.current = true;
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err.message);
        setPhase('error');
        toast.error(`Reports unavailable: ${err.message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when date range, report scope, or location changes
  useEffect(() => {
    if (!booted.current) return;
    if (phase === 'etl' || phase === 'error') return;
    loadReportsWithQuery(startDate, endDate, effectiveShopId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, reportScope, locationShopId, effectiveShopId, shop.id]);

  const refreshAll = async () => {
    setPhase('etl');
    setErrorMessage(null);
    try {
      const res = await api.post('/etl/sync');
      setEtlResponse(res);
      await loadReportsWithQuery(startDate, endDate, effectiveShopId);
      toast.success('Refreshed from BigQuery');
    } catch (err) {
      setErrorMessage(err.message);
      setPhase('error');
      toast.error(err.message);
    }
  };

  if (phase === 'etl') {
    return <BlockingScreen title="Refreshing data warehouse..." subtitle="Triggering the BigQuery ETL pipeline. This usually takes a few seconds." />;
  }
  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Reports unavailable: {errorMessage}
        </div>
        <button type="button" onClick={refreshAll} className="btn-primary mt-4">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Header
        shop={shop}
        reportTitle={reportTitle}
        reportScope={reportScope}
        setReportScope={setReportScope}
        allShops={allShops}
        locationShopId={locationShopId}
        setLocationShopId={setLocationShopId}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        refreshAll={refreshAll}
        loading={phase === 'loading'}
        etlResponse={etlResponse}
      />

      <KpiGrid kpis={data.kpis} />

      <Card title="Net revenue, profit, and transactions over time">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.revenueTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sale_date" />
            <YAxis yAxisId="left" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              formatter={(value, name) =>
                name === 'transactions' ? fmtNumber(value) : fmtCurrency(value)
              }
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="net_revenue" stroke={PALETTE[5]} strokeWidth={2} name="Net revenue" />
            <Line yAxisId="left" type="monotone" dataKey="net_profit" stroke={PALETTE[4]} strokeWidth={2} name="Net profit" />
            <Line yAxisId="right" type="monotone" dataKey="transactions" stroke={PALETTE[1]} strokeWidth={2} name="Transactions" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Sales velocity by hour of day">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={aggregateByHour(data.salesVelocity)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour_of_day" tickFormatter={(h) => `${h}:00`} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmtCurrency(v)} labelFormatter={(h) => `${h}:00`} />
              <Bar dataKey="net_revenue" fill={PALETTE[5]} name="Net revenue" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Sales velocity by day of week">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={aggregateByDay(data.salesVelocity)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day_name" />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmtCurrency(v)} />
              <Bar dataKey="net_revenue" fill={PALETTE[3]} name="Net revenue" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Top 10 products by net profit">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.topProducts} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
              <YAxis type="category" dataKey="product_name" width={150} />
              <Tooltip formatter={(v) => fmtCurrency(v)} />
              <Legend />
              <Bar dataKey="net_revenue" fill={PALETTE[5]} name="Net revenue" />
              <Bar dataKey="net_profit" fill={PALETTE[4]} name="Net profit" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Detail (units from warehouse)</h3>
            <Table
              columns={[
                { key: 'product_name', label: 'Product' },
                { key: 'category', label: 'Category' },
                { key: 'unit_measure', label: 'Unit' },
                { key: 'units_sold', label: 'Qty sold', format: fmtNumber },
                { key: 'net_revenue', label: 'Net revenue', format: fmtCurrency },
                { key: 'net_profit', label: 'Net profit', format: fmtCurrency },
              ]}
              rows={data.topProducts}
            />
          </div>
        </Card>

        <Card title="Sales mix by category">
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={data.categoryMix}
                dataKey="net_revenue"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={130}
                innerRadius={70}
                label={(entry) => entry.category}
              >
                {data.categoryMix.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmtCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Wastage - total loss value by reason">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.wastage.by_reason}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="reason" />
            <YAxis tickFormatter={(v) => `$${v}`} />
            <Tooltip formatter={(v) => fmtCurrency(v)} />
            <Bar dataKey="total_loss_value" name="Total loss value">
              {data.wastage.by_reason.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {data.wastage.by_product.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Top wasted products</h3>
            <Table
              columns={[
                { key: 'product_name', label: 'Product' },
                { key: 'category', label: 'Category' },
                { key: 'unit_measure', label: 'Unit' },
                {
                  key: 'quantity_wasted',
                  label: 'Qty wasted',
                  format: (v, row) =>
                    `${fmtNumber(v)}${row?.unit_measure && row.unit_measure !== '—' ? ` ${row.unit_measure}` : ''}`,
                },
                { key: 'events', label: 'Events', format: fmtNumber },
                { key: 'total_loss_value', label: 'Loss value', format: fmtCurrency },
              ]}
              rows={data.wastage.by_product}
            />
          </div>
        )}
      </Card>

      <Card title="Staff performance">
        <Table
          columns={[
            { key: 'staff_name', label: 'Staff' },
            { key: 'role', label: 'Role' },
            { key: 'transactions', label: 'Transactions', format: fmtNumber },
            { key: 'net_revenue', label: 'Net revenue', format: fmtCurrency },
            { key: 'net_profit', label: 'Net profit', format: fmtCurrency },
            { key: 'avg_basket', label: 'Avg basket', format: fmtCurrency },
          ]}
          rows={data.staff}
        />
      </Card>

      <Card title="Promotional ROI">
        <Table
          columns={[
            { key: 'promo_name', label: 'Promotion' },
            { key: 'discount_percent', label: 'Discount %', format: (v) => `${Number(v).toFixed(1)}%` },
            { key: 'redemptions', label: 'Redemptions', format: fmtNumber },
            { key: 'units_sold', label: 'Units', format: fmtNumber },
            { key: 'gross_pre_discount', label: 'Gross pre-discount', format: fmtCurrency },
            { key: 'discount_given', label: 'Discount given', format: fmtCurrency },
            { key: 'net_revenue', label: 'Net revenue', format: fmtCurrency },
            { key: 'discount_share', label: 'Margin bleed', format: fmtPercent },
          ]}
          rows={data.promo}
        />
      </Card>
    </div>
  );
}

function Header({
  shop,
  reportTitle,
  reportScope,
  setReportScope,
  allShops,
  locationShopId,
  setLocationShopId,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  refreshAll,
  loading,
  etlResponse,
}) {
  return (
    <header className="card flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Business Insights - {reportTitle}</h1>
        <p className="text-xs text-slate-500">
          Powered by BigQuery. Last ETL sync: {etlResponse ? `${etlResponse.message || 'OK'}` : 'unknown'}
          {reportScope === 'all'
            ? ' - Franchise-wide aggregates across every shop location.'
            : ` - Scoped to «${reportTitle}». Working shift locked as ${shop.shop_name}.`}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Report scope</label>
          <select
            className="input w-56"
            value={reportScope}
            onChange={(e) => {
              const v = e.target.value;
              setReportScope(v);
              if (v === 'current') setLocationShopId(shop.id);
              if (v === 'location') setLocationShopId(shop.id);
            }}
          >
            <option value="current">Current shop ({shop.shop_name})</option>
            <option value="all">All franchise locations</option>
            <option value="location">Pick another location...</option>
          </select>
        </div>
        {reportScope === 'location' && (
          <div>
            <label className="label">Location</label>
            <select
              className="input w-56"
              value={locationShopId}
              onChange={(e) => setLocationShopId(Number(e.target.value))}
            >
              {allShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shop_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="input w-40"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input
            type="date"
            className="input w-40"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button type="button" className="btn-primary" onClick={refreshAll} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh data'}
        </button>
      </div>
    </header>
  );
}

function KpiGrid({ kpis }) {
  if (!kpis) return null;
  const tiles = [
    { label: 'Net revenue', value: fmtCurrency(kpis.net_revenue), accent: 'bg-blue-50 text-blue-700' },
    { label: 'Gross revenue', value: fmtCurrency(kpis.gross_revenue), accent: 'bg-slate-50 text-slate-700' },
    { label: 'Net profit', value: fmtCurrency(kpis.net_profit), accent: 'bg-green-50 text-green-700' },
    { label: 'COGS', value: fmtCurrency(kpis.total_cogs), accent: 'bg-amber-50 text-amber-700' },
    { label: 'Tax paid', value: fmtCurrency(kpis.total_tax ?? 0), accent: 'bg-cyan-50 text-cyan-800' },
    { label: 'Transactions', value: fmtNumber(kpis.transactions), accent: 'bg-purple-50 text-purple-700' },
    { label: 'Avg basket', value: fmtCurrency(kpis.avg_basket), accent: 'bg-pink-50 text-pink-700' },
    { label: 'Total loss (wastage)', value: fmtCurrency(kpis.total_loss_value), accent: 'bg-red-50 text-red-700' },
    { label: 'Wastage events', value: fmtNumber(kpis.wastage_events), accent: 'bg-orange-50 text-orange-700' },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className={`rounded-lg p-4 shadow-sm ${t.accent}`}>
          <div className="text-xs font-medium uppercase tracking-wider opacity-70">{t.label}</div>
          <div className="mt-1 text-2xl font-bold">{t.value}</div>
        </div>
      ))}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="card">
      <h2 className="mb-3 text-base font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function Table({ columns, rows }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-slate-500">No data for this period.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2">
                  {c.format ? c.format(row[c.key], row) : String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockingScreen({ title, subtitle }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" />
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function aggregateByHour(rows) {
  const map = new Map();
  for (const row of rows) {
    const h = row.hour_of_day;
    const existing = map.get(h) ?? { hour_of_day: h, net_revenue: 0, transactions: 0 };
    existing.net_revenue += Number(row.net_revenue) || 0;
    existing.transactions += Number(row.transactions) || 0;
    map.set(h, existing);
  }
  return [...map.values()].sort((a, b) => a.hour_of_day - b.hour_of_day);
}

function aggregateByDay(rows) {
  const map = new Map();
  for (const row of rows) {
    const d = row.day_name;
    const existing = map.get(d) ?? { day_name: d, net_revenue: 0, transactions: 0 };
    existing.net_revenue += Number(row.net_revenue) || 0;
    existing.transactions += Number(row.transactions) || 0;
    map.set(d, existing);
  }
  return DAY_ORDER.filter((d) => map.has(d)).map((d) => map.get(d));
}
