import CrudTable from '../../components/CrudTable.jsx';

const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'];

export default function Customers() {
  return (
    <CrudTable
      title="Customers"
      resource="/customers"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'first_name', label: 'First name' },
        { key: 'last_name', label: 'Last name' },
        { key: 'email', label: 'Email' },
        { key: 'loyalty_tier', label: 'Tier' },
      ]}
      fields={[
        { key: 'first_name', label: 'First name', type: 'text' },
        { key: 'last_name', label: 'Last name', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
        {
          key: 'loyalty_tier',
          label: 'Loyalty tier',
          type: 'select',
          valueType: 'string',
          options: TIERS.map((t) => ({ value: t, label: t })),
        },
      ]}
      makeEmpty={(row = {}) => ({
        first_name: row.first_name ?? '',
        last_name: row.last_name ?? '',
        email: row.email ?? '',
        loyalty_tier: row.loyalty_tier ?? '',
      })}
    />
  );
}
