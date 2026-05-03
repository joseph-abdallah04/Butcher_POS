import CrudTable from '../../components/CrudTable.jsx';

export default function Shops() {
  return (
    <CrudTable
      title="Shops"
      resource="/shops"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'shop_name', label: 'Name' },
        { key: 'shop_code', label: 'Code' },
        { key: 'location', label: 'Location' },
      ]}
      fields={[
        { key: 'shop_name', label: 'Shop name', type: 'text', required: true },
        { key: 'shop_code', label: 'Shop code', type: 'text', required: true },
        { key: 'location', label: 'Location', type: 'text', full: true },
      ]}
      makeEmpty={(row = {}) => ({
        shop_name: row.shop_name ?? '',
        shop_code: row.shop_code ?? '',
        location: row.location ?? '',
      })}
    />
  );
}
