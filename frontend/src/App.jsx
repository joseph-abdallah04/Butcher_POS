import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ShopLockGate from './components/ShopLockGate.jsx';
import { useSession } from './context/SessionContext.jsx';
import POS from './pages/POS.jsx';
import Reports from './pages/Reports.jsx';
import Wastage from './pages/Wastage.jsx';
import Categories from './pages/admin/Categories.jsx';
import Customers from './pages/admin/Customers.jsx';
import Products from './pages/admin/Products.jsx';
import Promotions from './pages/admin/Promotions.jsx';
import Shops from './pages/admin/Shops.jsx';
import Staff from './pages/admin/Staff.jsx';
import Suppliers from './pages/admin/Suppliers.jsx';
import Inventory from './pages/admin/Inventory.jsx';

function RequireManager({ children }) {
  const { isManager } = useSession();
  if (!isManager) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ShopLockGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<POS />} />
          <Route path="wastage" element={<Wastage />} />
          <Route path="reports" element={<Reports />} />
          <Route
            path="admin/*"
            element={
              <RequireManager>
                <Routes>
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="products" element={<Products />} />
                  <Route path="categories" element={<Categories />} />
                  <Route path="suppliers" element={<Suppliers />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="promotions" element={<Promotions />} />
                  <Route path="staff" element={<Staff />} />
                  <Route path="shops" element={<Shops />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </RequireManager>
            }
          />
        </Route>
      </Routes>
    </ShopLockGate>
  );
}
