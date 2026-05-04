import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { isDemo } from '../demo.js';

const NAV = [
  { to: '/', label: 'POS', end: true },
  { to: '/wastage', label: 'Wastage' },
  { to: '/reports', label: 'Reports' },
];

const ADMIN = [
  { to: '/admin/inventory', label: 'Inventory' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/suppliers', label: 'Suppliers' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/promotions', label: 'Promotions' },
  { to: '/admin/staff', label: 'Staff' },
  { to: '/admin/shops', label: 'Shops' },
];

export default function Layout() {
  const { shop, staff, reset, isManager } = useSession();

  return (
    <div className="flex h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-slate-900 text-slate-100">
        <div className="border-b border-slate-800 px-4 py-4">
          <div className="text-lg font-bold">Butchery POS</div>
          <div className="mt-1 text-xs text-slate-400">{shop?.shop_name}</div>
          <div className="text-xs text-slate-400">
            Staff: {staff?.staff_name}
            {staff?.role ? ` (${staff.role})` : ''}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <SectionLabel>Operations</SectionLabel>
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          {isManager && (
            <>
              <SectionLabel>Admin</SectionLabel>
              {ADMIN.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <button type="button" className="btn-secondary w-full" onClick={reset}>
            Switch shop / staff
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-slate-100">
        {isDemo && (
          <div className="bg-yellow-300 px-4 py-1 text-center text-xs font-semibold text-yellow-900">
            DEMO MODE - using in-memory mock data, nothing is persisted
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="mt-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </div>
  );
}

function NavItem({ to, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `mt-1 block rounded-md px-3 py-2 text-sm font-medium ${
          isActive ? 'bg-brand-600 text-white' : 'text-slate-200 hover:bg-slate-800'
        }`
      }
    >
      {label}
    </NavLink>
  );
}
