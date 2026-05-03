import CrudTable from '../../components/CrudTable.jsx';

export default function Suppliers() {
  return (
    <CrudTable
      title="Suppliers"
      resource="/suppliers"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'company_name', label: 'Company' },
        { key: 'contact_person', label: 'Contact' },
        { key: 'email', label: 'Email' },
      ]}
      fields={[
        { key: 'company_name', label: 'Company name', type: 'text', required: true, full: true },
        { key: 'contact_person', label: 'Contact person', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
      ]}
      makeEmpty={(row = {}) => ({
        company_name: row.company_name ?? '',
        contact_person: row.contact_person ?? '',
        email: row.email ?? '',
      })}
    />
  );
}
