import CrudTable from '../../components/CrudTable.jsx';

export default function Promotions() {
  return (
    <CrudTable
      title="Promotions"
      resource="/promotions"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'promo_name', label: 'Name' },
        {
          key: 'discount_percent',
          label: 'Discount %',
          render: (row) => Number(row.discount_percent).toFixed(2),
        },
        {
          key: 'is_active',
          label: 'Active',
          render: (row) => (row.is_active ? 'Yes' : 'No'),
        },
      ]}
      fields={[
        { key: 'promo_name', label: 'Promo name', type: 'text', required: true, full: true },
        { key: 'discount_percent', label: 'Discount %', type: 'number', required: true },
        { key: 'is_active', label: 'Active', type: 'checkbox' },
      ]}
      makeEmpty={(row = {}) => ({
        promo_name: row.promo_name ?? '',
        discount_percent: row.discount_percent ?? 0,
        is_active: row.is_active ?? true,
      })}
    />
  );
}
