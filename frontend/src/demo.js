/**
 * In-memory demo data so the UI can be previewed without a backend.
 * Activated by setting VITE_DEMO=true (see `npm run demo`).
 */

const now = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let nextId = 1000;
const mintId = () => ++nextId;

const db = {
  shops: [
    { id: 1, shop_name: 'Joe&apos;s Butchery - Newtown', shop_code: 'NEW', location: 'Sydney, NSW' },
    { id: 2, shop_name: 'Joe&apos;s Butchery - Carlton', shop_code: 'CAR', location: 'Melbourne, VIC' },
  ],
  staff: [
    { id: 11, staff_name: 'Alex Tan', role: 'Manager', shop_id: 1 },
    { id: 12, staff_name: 'Priya Singh', role: 'Butcher', shop_id: 1 },
    { id: 13, staff_name: 'Sam Walker', role: 'Cashier', shop_id: 1 },
    { id: 14, staff_name: 'Maria Costa', role: 'Manager', shop_id: 2 },
  ],
  categories: [
    { id: 21, name: 'Beef' },
    { id: 22, name: 'Lamb' },
    { id: 23, name: 'Poultry' },
    { id: 24, name: 'Smallgoods' },
    { id: 25, name: 'Pork' },
  ],
  suppliers: [
    { id: 31, company_name: 'Riverlands Beef Co.', contact_person: 'Tom Brady', email: 'tom@riverlands.com' },
    { id: 32, company_name: 'Highland Lamb Pty', contact_person: 'Aoife Murphy', email: 'aoife@hlamb.com' },
    { id: 33, company_name: 'Sunset Poultry', contact_person: 'Lin Chen', email: 'lin@sunsetp.com' },
  ],
  customers: [
    { id: 41, first_name: 'Hannah', last_name: 'Lee', email: 'hannah@example.com', loyalty_tier: 'Gold' },
    { id: 42, first_name: 'David', last_name: 'Nguyen', email: 'david@example.com', loyalty_tier: 'Silver' },
    { id: 43, first_name: 'Walk-in', last_name: '', email: null, loyalty_tier: 'Bronze' },
  ],
  promotions: [
    { id: 51, promo_name: 'Weekend Special', discount_percent: 10, is_active: true },
    { id: 52, promo_name: 'Loyalty Reward', discount_percent: 5, is_active: true },
    { id: 53, promo_name: 'Closing Down', discount_percent: 25, is_active: false },
  ],
  products: [
    { id: 61, product_name: 'Eye Fillet Steak', category_id: 21, supplier_id: 31, unit_price: 59.95, cost_price: 38, unit_measure: 'kg' },
    { id: 62, product_name: 'Beef Mince', category_id: 21, supplier_id: 31, unit_price: 16.5, cost_price: 9, unit_measure: 'kg' },
    { id: 63, product_name: 'Ribeye Steak', category_id: 21, supplier_id: 31, unit_price: 49.5, cost_price: 31, unit_measure: 'kg' },
    { id: 64, product_name: 'Lamb Chops', category_id: 22, supplier_id: 32, unit_price: 28.0, cost_price: 17, unit_measure: 'kg' },
    { id: 65, product_name: 'Lamb Shoulder', category_id: 22, supplier_id: 32, unit_price: 22.0, cost_price: 13, unit_measure: 'kg' },
    { id: 66, product_name: 'Whole Chicken', category_id: 23, supplier_id: 33, unit_price: 12.5, cost_price: 7, unit_measure: 'each' },
    { id: 67, product_name: 'Chicken Breast', category_id: 23, supplier_id: 33, unit_price: 18.0, cost_price: 10, unit_measure: 'kg' },
    { id: 68, product_name: 'Pork Belly', category_id: 25, supplier_id: 31, unit_price: 24.0, cost_price: 14, unit_measure: 'kg' },
    { id: 69, product_name: 'Italian Sausages', category_id: 24, supplier_id: 31, unit_price: 14.0, cost_price: 7, unit_measure: 'kg' },
    { id: 70, product_name: 'Bacon Rashers', category_id: 24, supplier_id: 31, unit_price: 16.0, cost_price: 8, unit_measure: 'kg' },
    { id: 71, product_name: 'Beef Brisket', category_id: 21, supplier_id: 31, unit_price: 21.0, cost_price: 12, unit_measure: 'kg' },
    { id: 72, product_name: 'Lamb Cutlets', category_id: 22, supplier_id: 32, unit_price: 38.0, cost_price: 22, unit_measure: 'kg' },
  ],
  sales: [],
  wastage: [],
  inventory: [
    {
      id: 901,
      shop_id: 1,
      product_id: 61,
      stock_level: 48.5,
      last_restock_date: now(),
    },
    {
      id: 902,
      shop_id: 1,
      product_id: 62,
      stock_level: 120,
      last_restock_date: now(),
    },
    {
      id: 903,
      shop_id: 2,
      product_id: 64,
      stock_level: 35,
      last_restock_date: now(),
    },
  ],
};

const enrichProduct = (p) => ({
  ...p,
  category_name: db.categories.find((c) => c.id === p.category_id)?.name ?? null,
  supplier_name: db.suppliers.find((s) => s.id === p.supplier_id)?.company_name ?? null,
});

function getDemoOnHand(shopId, productId) {
  const row = db.inventory.find((i) => i.shop_id === shopId && i.product_id === productId);
  return row ? Number(row.stock_level) : 0;
}

function adjustDemoInventory(shopId, productId, delta) {
  const d = Number(delta);
  let row = db.inventory.find((i) => i.shop_id === shopId && i.product_id === productId);
  if (d < 0) {
    if (!row) {
      const p = db.products.find((x) => x.id === productId);
      const label = p?.product_name ?? `product #${productId}`;
      throw new Error(`Insufficient stock for ${label}: on hand 0, requested ${-d}.`);
    }
    const next = Number(row.stock_level) + d;
    if (next < 0) {
      const p = db.products.find((x) => x.id === productId);
      const label = p?.product_name ?? `product #${productId}`;
      throw new Error(
        `Insufficient stock for ${label}: on hand ${row.stock_level}, requested ${-d}.`,
      );
    }
    row.stock_level = next;
    return;
  }
  if (!row) {
    row = {
      id: mintId(),
      shop_id: shopId,
      product_id: productId,
      stock_level: 0,
      last_restock_date: now(),
    };
    db.inventory.push(row);
  }
  row.stock_level = Number(row.stock_level) + d;
}

function enrichInventoryRow(row) {
  const p = db.products.find((x) => x.id === row.product_id);
  return {
    ...row,
    product_name: p?.product_name ?? `Product #${row.product_id}`,
    unit_measure: p?.unit_measure ?? null,
  };
}

/** Rough scaling so switching report scope visibly changes demo numbers. */
function demoReportMultiplier(query) {
  if (!query?.shop_id && query?.shop_id !== 0) return 3;
  const sid = Number(query.shop_id);
  if (sid === 1) return 1;
  if (sid === 2) return 0.65;
  return 0.85;
}

const handlers = {
  'GET /shops': () => db.shops,
  'POST /shops': (body) => {
    const created = { id: mintId(), ...body };
    db.shops.push(created);
    return created;
  },
  'GET /shops/:id/staff': (_, params) =>
    db.staff.filter((s) => s.shop_id === Number(params.id)),

  'GET /staff': (_, __, query) => {
    let rows = db.staff;
    if (query?.shop_id) rows = rows.filter((s) => s.shop_id === Number(query.shop_id));
    return rows;
  },
  'POST /staff': (body) => {
    const created = { id: mintId(), ...body };
    db.staff.push(created);
    return created;
  },
  'PUT /staff/:id': (body, params) => {
    const row = db.staff.find((s) => s.id === Number(params.id));
    Object.assign(row, body);
    return row;
  },
  'DELETE /staff/:id': (_, params) => {
    db.staff = db.staff.filter((s) => s.id !== Number(params.id));
    return null;
  },

  'GET /categories': () => db.categories,
  'POST /categories': (body) => {
    const created = { id: mintId(), ...body };
    db.categories.push(created);
    return created;
  },
  'PUT /categories/:id': (body, params) => {
    const row = db.categories.find((c) => c.id === Number(params.id));
    Object.assign(row, body);
    return row;
  },
  'DELETE /categories/:id': (_, params) => {
    db.categories = db.categories.filter((c) => c.id !== Number(params.id));
    return null;
  },

  'GET /suppliers': () => db.suppliers,
  'POST /suppliers': (body) => {
    const created = { id: mintId(), ...body };
    db.suppliers.push(created);
    return created;
  },
  'PUT /suppliers/:id': (body, params) => {
    const row = db.suppliers.find((s) => s.id === Number(params.id));
    Object.assign(row, body);
    return row;
  },
  'DELETE /suppliers/:id': (_, params) => {
    db.suppliers = db.suppliers.filter((s) => s.id !== Number(params.id));
    return null;
  },

  'GET /customers': () => db.customers,
  'POST /customers': (body) => {
    const created = { id: mintId(), ...body };
    db.customers.push(created);
    return created;
  },
  'PUT /customers/:id': (body, params) => {
    const row = db.customers.find((c) => c.id === Number(params.id));
    Object.assign(row, body);
    return row;
  },
  'DELETE /customers/:id': (_, params) => {
    db.customers = db.customers.filter((c) => c.id !== Number(params.id));
    return null;
  },

  'GET /promotions': (_, __, query) => {
    if (query?.active_only === 'true' || query?.active_only === true) {
      return db.promotions.filter((p) => p.is_active);
    }
    return db.promotions;
  },
  'POST /promotions': (body) => {
    const created = { id: mintId(), ...body };
    db.promotions.push(created);
    return created;
  },
  'PUT /promotions/:id': (body, params) => {
    const row = db.promotions.find((p) => p.id === Number(params.id));
    Object.assign(row, body);
    return row;
  },
  'DELETE /promotions/:id': (_, params) => {
    db.promotions = db.promotions.filter((p) => p.id !== Number(params.id));
    return null;
  },

  'GET /products': (_, __, query) => {
    let rows = db.products;
    if (query?.category_id) rows = rows.filter((p) => p.category_id === Number(query.category_id));
    return rows.map(enrichProduct);
  },
  'POST /products': (body) => {
    const created = { id: mintId(), ...body };
    db.products.push(created);
    return enrichProduct(created);
  },
  'PUT /products/:id': (body, params) => {
    const row = db.products.find((p) => p.id === Number(params.id));
    Object.assign(row, body);
    return enrichProduct(row);
  },
  'DELETE /products/:id': (_, params) => {
    db.products = db.products.filter((p) => p.id !== Number(params.id));
    return null;
  },

  'POST /sales': (body) => {
    const totals = new Map();
    for (const i of body.items) {
      const pid = i.product_id;
      totals.set(pid, (totals.get(pid) || 0) + Number(i.quantity));
    }
    for (const [productId, qty] of totals) {
      const onHand = getDemoOnHand(body.shop_id, productId);
      if (onHand < qty) {
        const p = db.products.find((x) => x.id === productId);
        const label = p?.product_name ?? `product #${productId}`;
        throw new Error(`Insufficient stock for ${label}: on hand ${onHand}, requested ${qty}.`);
      }
    }
    const total = body.items.reduce(
      (sum, i) => sum + i.quantity * i.price_at_sale - (i.discount_applied || 0),
      0,
    );
    const sale = {
      id: mintId(),
      shop_id: body.shop_id,
      staff_id: body.staff_id,
      customer_id: body.customer_id,
      promo_id: body.promo_id,
      payment_method: body.payment_method,
      total_amount: total,
      created_at: now(),
      items: body.items.map((i, idx) => ({ id: mintId() + idx, sale_id: nextId, ...i })),
    };
    db.sales.push(sale);
    for (const i of body.items) {
      adjustDemoInventory(body.shop_id, i.product_id, -Number(i.quantity));
    }
    return sale;
  },
  'GET /sales': () => db.sales,

  'POST /wastage': (body) => {
    const qty = Number(body.quantity_wasted);
    const onHand = getDemoOnHand(body.shop_id, body.product_id);
    if (onHand < qty) {
      const p = db.products.find((x) => x.id === body.product_id);
      const label = p?.product_name ?? `product #${body.product_id}`;
      throw new Error(`Insufficient stock for ${label}: on hand ${onHand}, requested ${qty}.`);
    }
    const created = { id: mintId(), created_at: now(), ...body };
    db.wastage.push(created);
    adjustDemoInventory(body.shop_id, body.product_id, -qty);
    return created;
  },
  'GET /wastage': (_, __, query) => {
    let rows = db.wastage;
    if (query?.shop_id) rows = rows.filter((w) => w.shop_id === Number(query.shop_id));
    return rows.slice().reverse();
  },

  'GET /inventory': (_, __, query) => {
    let rows = db.inventory;
    if (query?.shop_id != null && query?.shop_id !== '')
      rows = rows.filter((i) => i.shop_id === Number(query.shop_id));
    return rows.map(enrichInventoryRow);
  },

  'POST /inventory/restock': (body) => {
    let row = db.inventory.find(
      (i) => i.shop_id === body.shop_id && i.product_id === body.product_id,
    );
    if (!row) {
      row = {
        id: mintId(),
        shop_id: body.shop_id,
        product_id: body.product_id,
        stock_level: 0,
        last_restock_date: now(),
      };
      db.inventory.push(row);
    }
    row.stock_level = Number(row.stock_level) + Number(body.quantity);
    row.last_restock_date = now();
    return enrichInventoryRow(row);
  },

  'POST /etl/sync': () => ({
    status: 'ok',
    message: '[DEMO] ETL pipeline triggered successfully',
    rows_processed: 42,
    duration_seconds: 1.7,
    triggered_at: now(),
  }),

  'GET /reports/kpis': (_, __, query) => {
    const m = demoReportMultiplier(query);
    const base = {
      gross_revenue: 184320.5,
      net_revenue: 168912.4,
      net_profit: 62418.75,
      total_cogs: 106493.65,
      total_tax: 15408.1,
      transactions: 1284,
      avg_basket: 131.55,
      total_loss_value: 4823.6,
      wastage_events: 87,
      start_date: '2026-04-04',
      end_date: '2026-05-03',
    };
    return {
      gross_revenue: base.gross_revenue * m,
      net_revenue: base.net_revenue * m,
      net_profit: base.net_profit * m,
      total_cogs: base.total_cogs * m,
      total_tax: base.total_tax * m,
      transactions: Math.round(base.transactions * m),
      avg_basket: base.avg_basket,
      total_loss_value: base.total_loss_value * m,
      wastage_events: Math.round(base.wastage_events * m),
      start_date: base.start_date,
      end_date: base.end_date,
    };
  },

  'GET /reports/revenue-trend': (_, __, query) => {
    const m = demoReportMultiplier(query);
    const out = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dow = d.getDay();
      const base = 4500 + Math.sin(i / 4) * 800 + (dow === 0 || dow === 6 ? 1500 : 0);
      const noise = (Math.sin(i * 7) + 1) * 400;
      const net = Math.round(base + noise);
      out.push({
        sale_date: d.toISOString().slice(0, 10),
        gross_revenue: Math.round(net * 1.09 * m),
        net_revenue: Math.round(net * m),
        net_profit: Math.round(net * 0.37 * m),
        transactions: Math.round((35 + Math.sin(i / 3) * 8 + (dow === 0 || dow === 6 ? 18 : 0)) * m),
      });
    }
    return out;
  },

  'GET /reports/sales-velocity': (_, __, query) => {
    const m = demoReportMultiplier(query);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const out = [];
    for (const day of days) {
      for (let h = 8; h <= 19; h++) {
        const peak = day === 'Saturday' || day === 'Sunday' ? 1.4 : 1;
        const hourFactor = h >= 11 && h <= 13 ? 1.6 : h >= 16 && h <= 18 ? 1.8 : 0.7;
        const revenue = Math.round((120 * peak * hourFactor + Math.random() * 60) * m);
        out.push({
          day_name: day,
          hour_of_day: h,
          net_revenue: revenue,
          transactions: Math.round(revenue / 35),
        });
      }
    }
    return out;
  },

  'GET /reports/top-products': (_, __, query) => {
    const m = demoReportMultiplier(query);
    const rows = [
      { product_id: 61, product_name: 'Eye Fillet Steak', category: 'Beef', unit_measure: 'kg', units_sold: 412, net_revenue: 24685, net_profit: 13280 },
      { product_id: 64, product_name: 'Lamb Chops', category: 'Lamb', unit_measure: 'kg', units_sold: 528, net_revenue: 14784, net_profit: 6182 },
      { product_id: 63, product_name: 'Ribeye Steak', category: 'Beef', unit_measure: 'kg', units_sold: 285, net_revenue: 14107, net_profit: 5278 },
      { product_id: 67, product_name: 'Chicken Breast', category: 'Poultry', unit_measure: 'kg', units_sold: 720, net_revenue: 12960, net_profit: 5760 },
      { product_id: 72, product_name: 'Lamb Cutlets', category: 'Lamb', unit_measure: 'kg', units_sold: 198, net_revenue: 7524, net_profit: 3168 },
      { product_id: 68, product_name: 'Pork Belly', category: 'Pork', unit_measure: 'kg', units_sold: 290, net_revenue: 6960, net_profit: 2900 },
      { product_id: 62, product_name: 'Beef Mince', category: 'Beef', unit_measure: 'kg', units_sold: 920, net_revenue: 15180, net_profit: 6900 },
      { product_id: 70, product_name: 'Bacon Rashers', category: 'Smallgoods', unit_measure: 'each', units_sold: 380, net_revenue: 6080, net_profit: 3040 },
      { product_id: 69, product_name: 'Italian Sausages', category: 'Smallgoods', unit_measure: 'each', units_sold: 480, net_revenue: 6720, net_profit: 3360 },
      { product_id: 66, product_name: 'Whole Chicken', category: 'Poultry', unit_measure: 'each', units_sold: 220, net_revenue: 2750, net_profit: 1210 },
    ];
    return rows.map((r) => ({
      ...r,
      units_sold: Math.round(r.units_sold * m),
      net_revenue: Math.round(r.net_revenue * m),
      net_profit: Math.round(r.net_profit * m),
    }));
  },

  'GET /reports/category-mix': (_, __, query) => {
    const m = demoReportMultiplier(query);
    const rows = [
      { category: 'Beef', net_revenue: 78340, net_profit: 31420, units: 2150 },
      { category: 'Lamb', net_revenue: 32480, net_profit: 12860, units: 980 },
      { category: 'Poultry', net_revenue: 22560, net_profit: 9840, units: 1340 },
      { category: 'Smallgoods', net_revenue: 18920, net_profit: 7560, units: 1610 },
      { category: 'Pork', net_revenue: 16612, net_profit: 6738, units: 740 },
    ];
    return rows.map((r) => ({
      ...r,
      net_revenue: Math.round(r.net_revenue * m),
      net_profit: Math.round(r.net_profit * m),
      units: Math.round(r.units * m),
    }));
  },

  'GET /reports/wastage-summary': (_, __, query) => {
    const m = demoReportMultiplier(query);
    return {
      by_reason: [
        { reason: 'Expired', total_loss_value: 1820.4 * m, quantity_wasted: 86.4 * m, events: Math.round(31 * m) },
        { reason: 'Fridge Failure', total_loss_value: 1340.0 * m, quantity_wasted: 54.2 * m, events: Math.round(4 * m) },
        { reason: 'Cutting Error', total_loss_value: 720.5 * m, quantity_wasted: 38.1 * m, events: Math.round(22 * m) },
        { reason: 'Damaged', total_loss_value: 480.2 * m, quantity_wasted: 21.0 * m, events: Math.round(18 * m) },
        { reason: 'Spoiled', total_loss_value: 290.5 * m, quantity_wasted: 14.5 * m, events: Math.round(8 * m) },
        { reason: 'Cross-Contamination', total_loss_value: 172.0 * m, quantity_wasted: 6.2 * m, events: Math.round(4 * m) },
      ],
      by_product: [
        { product_id: 64, product_name: 'Lamb Chops', category: 'Lamb', unit_measure: 'kg', total_loss_value: 980.5 * m, quantity_wasted: 35.0 * m, events: Math.round(12 * m) },
        { product_id: 67, product_name: 'Chicken Breast', category: 'Poultry', unit_measure: 'kg', total_loss_value: 720.0 * m, quantity_wasted: 40.0 * m, events: Math.round(14 * m) },
        { product_id: 62, product_name: 'Beef Mince', category: 'Beef', unit_measure: 'kg', total_loss_value: 540.0 * m, quantity_wasted: 60.0 * m, events: Math.round(18 * m) },
        { product_id: 70, product_name: 'Bacon Rashers', category: 'Smallgoods', unit_measure: 'each', total_loss_value: 320.0 * m, quantity_wasted: 20.0 * m, events: Math.round(8 * m) },
        { product_id: 66, product_name: 'Whole Chicken', category: 'Poultry', unit_measure: 'each', total_loss_value: 245.0 * m, quantity_wasted: 35.0 * m, events: Math.round(7 * m) },
      ],
    };
  },

  'GET /reports/staff-performance': (_, __, query) => {
    const m = demoReportMultiplier(query);
    const rows = [
      { staff_id: 11, staff_name: 'Alex Tan', role: 'Manager', transactions: 412, net_revenue: 58620, net_profit: 21340, avg_basket: 142.28 },
      { staff_id: 12, staff_name: 'Priya Singh', role: 'Butcher', transactions: 380, net_revenue: 51840, net_profit: 19260, avg_basket: 136.42 },
      { staff_id: 13, staff_name: 'Sam Walker', role: 'Cashier', transactions: 492, net_revenue: 58452, net_profit: 21818, avg_basket: 118.81 },
    ];
    return rows.map((r) => ({
      ...r,
      transactions: Math.round(r.transactions * m),
      net_revenue: Math.round(r.net_revenue * m),
      net_profit: Math.round(r.net_profit * m),
      avg_basket: r.avg_basket,
    }));
  },

  'GET /reports/promo-roi': (_, __, query) => {
    const m = demoReportMultiplier(query);
    return [
      {
        promo_id: 51,
        promo_name: 'Weekend Special',
        discount_percent: 10,
        redemptions: Math.round(286 * m),
        units_sold: Math.round(540 * m),
        gross_pre_discount: Math.round(32480 * m),
        discount_given: Math.round(3248 * m),
        net_revenue: Math.round(29232 * m),
        discount_share: 0.1,
      },
      {
        promo_id: 52,
        promo_name: 'Loyalty Reward',
        discount_percent: 5,
        redemptions: Math.round(142 * m),
        units_sold: Math.round(320 * m),
        gross_pre_discount: Math.round(18420 * m),
        discount_given: Math.round(921 * m),
        net_revenue: Math.round(17499 * m),
        discount_share: 0.05,
      },
    ];
  },

  'GET /api/health': () => ({ status: 'ok', mode: 'demo' }),
};

function matchRoute(method, path) {
  for (const key of Object.keys(handlers)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: handlers[key], params };
  }
  return null;
}

export async function demoFetch(method, path, body, query) {
  await sleep(120);
  const match = matchRoute(method, path);
  if (!match) {
    throw new Error(`[demo] No handler for ${method} ${path}`);
  }
  return match.handler(body, match.params, query);
}

export const isDemo = import.meta.env.VITE_DEMO === 'true';
