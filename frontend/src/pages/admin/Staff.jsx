import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import CrudTable from '../../components/CrudTable.jsx';

export default function Staff() {
  const [shops, setShops] = useState([]);

  useEffect(() => {
    api.get('/shops').then(setShops).catch(() => {});
  }, []);

  if (shops.length === 0) {
    return <div className="p-6 text-slate-500">Loading shops...</div>;
  }

  const shopOptions = shops.map((s) => ({ value: s.id, label: `${s.shop_name} (${s.shop_code})` }));
  const shopName = (id) => shops.find((s) => s.id === id)?.shop_name || `#${id}`;

  return (
    <CrudTable
      title="Staff"
      resource="/staff"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'staff_name', label: 'Name' },
        { key: 'role', label: 'Role' },
        { key: 'shop_id', label: 'Shop', render: (row) => shopName(row.shop_id) },
      ]}
      fields={[
        { key: 'staff_name', label: 'Name', type: 'text', required: true },
        { key: 'role', label: 'Role', type: 'text' },
        {
          key: 'shop_id',
          label: 'Shop',
          type: 'select',
          required: true,
          options: shopOptions,
          full: true,
        },
      ]}
      makeEmpty={(row = {}) => ({
        staff_name: row.staff_name ?? '',
        role: row.role ?? '',
        shop_id: row.shop_id ?? '',
      })}
    />
  );
}
