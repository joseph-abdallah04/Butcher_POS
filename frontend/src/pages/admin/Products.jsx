import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import CrudTable from '../../components/CrudTable.jsx';

export default function Products() {
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/categories'), api.get('/suppliers')])
      .then(([c, s]) => {
        setCategories(c);
        setSuppliers(s);
      })
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return <div className="p-6 text-slate-500">Loading...</div>;

  return (
    <CrudTable
      title="Products"
      resource="/products"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'product_name', label: 'Name' },
        { key: 'category_name', label: 'Category' },
        { key: 'supplier_name', label: 'Supplier' },
        {
          key: 'unit_price',
          label: 'Price',
          render: (row) => `$${Number(row.unit_price).toFixed(2)}`,
        },
        { key: 'unit_measure', label: 'Unit' },
      ]}
      fields={[
        { key: 'product_name', label: 'Product name', type: 'text', required: true, full: true },
        {
          key: 'category_id',
          label: 'Category',
          type: 'select',
          options: categories.map((c) => ({ value: c.id, label: c.name })),
        },
        {
          key: 'supplier_id',
          label: 'Supplier',
          type: 'select',
          options: suppliers.map((s) => ({ value: s.id, label: s.company_name })),
        },
        { key: 'unit_price', label: 'Unit price', type: 'number', required: true },
        { key: 'cost_price', label: 'Cost price', type: 'number' },
        { key: 'unit_measure', label: 'Unit measure (e.g. kg)', type: 'text' },
      ]}
      makeEmpty={(row = {}) => ({
        product_name: row.product_name ?? '',
        category_id: row.category_id ?? '',
        supplier_id: row.supplier_id ?? '',
        unit_price: row.unit_price ?? '',
        cost_price: row.cost_price ?? '',
        unit_measure: row.unit_measure ?? '',
      })}
    />
  );
}
