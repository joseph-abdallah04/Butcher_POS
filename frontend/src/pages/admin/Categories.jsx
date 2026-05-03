import CrudTable from '../../components/CrudTable.jsx';

export default function Categories() {
  return (
    <CrudTable
      title="Categories"
      resource="/categories"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
      ]}
      fields={[{ key: 'name', label: 'Name', type: 'text', required: true, full: true }]}
      makeEmpty={(row = {}) => ({ name: row.name ?? '' })}
    />
  );
}
