import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ShopLockGate from './components/ShopLockGate.jsx';
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

export default function App() {
  return (
    <ShopLockGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<POS />} />
          <Route path="wastage" element={<Wastage />} />
          <Route path="reports" element={<Reports />} />
          <Route path="admin/inventory" element={<Inventory />} />
          <Route path="admin/products" element={<Products />} />
          <Route path="admin/categories" element={<Categories />} />
          <Route path="admin/suppliers" element={<Suppliers />} />
          <Route path="admin/customers" element={<Customers />} />
          <Route path="admin/promotions" element={<Promotions />} />
          <Route path="admin/staff" element={<Staff />} />
          <Route path="admin/shops" element={<Shops />} />
        </Route>
      </Routes>
    </ShopLockGate>
  );
}
