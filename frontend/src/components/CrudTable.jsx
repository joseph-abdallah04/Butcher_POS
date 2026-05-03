import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from './Modal.jsx';
import { useToast } from './Toast.jsx';

/**
 * A reusable admin CRUD page.
 *
 * Props:
 *   title:    page heading
 *   resource: api path under /api (e.g. "/products")
 *   columns:  [{ key, label, render?: (row) => ReactNode }]
 *   fields:   [{ key, label, type ('text'|'number'|'select'|'checkbox'), options?, required? }]
 *   makeEmpty: () => initial form state
 *   listQuery: optional query params for list call
 */
export default function CrudTable({ title, resource, columns, fields, makeEmpty, listQuery }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(makeEmpty());
  const [submitting, setSubmitting] = useState(false);

  const reload = () => {
    setLoading(true);
    api.get(resource, listQuery)
      .then(setRows)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [resource, JSON.stringify(listQuery)]);

  const openCreate = () => {
    setEditing({ mode: 'create' });
    setForm(makeEmpty());
  };

  const openEdit = (row) => {
    setEditing({ mode: 'edit', id: row.id });
    setForm(makeEmpty(row));
  };

  const close = () => {
    setEditing(null);
    setForm(makeEmpty());
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const cleaned = cleanPayload(form, fields);
      if (editing.mode === 'create') {
        await api.post(resource, cleaned);
        toast.success('Created');
      } else {
        await api.put(`${resource}/${editing.id}`, cleaned);
        toast.success('Saved');
      }
      close();
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (row) => {
    if (!confirm(`Delete row #${row.id}?`)) return;
    try {
      await api.del(`${resource}/${row.id}`);
      toast.success('Deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + New
        </button>
      </header>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-2">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && (
              <tr>
                <td className="px-4 py-3 text-slate-500" colSpan={columns.length + 1}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-slate-500" colSpan={columns.length + 1}>
                  No records yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-2">
                    {c.render ? c.render(row) : String(row[c.key] ?? '')}
                  </td>
                ))}
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    className="mr-2 text-sm text-brand-700 hover:underline"
                    onClick={() => openEdit(row)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => remove(row)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(editing)}
        title={editing?.mode === 'create' ? `New ${title.replace(/s$/, '')}` : `Edit #${editing?.id}`}
        onClose={close}
        wide
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button type="submit" form="crud-form" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <form id="crud-form" className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          {fields.map((f) => (
            <FormField key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} />
          ))}
        </form>
      </Modal>
    </div>
  );
}

function FormField({ field, value, onChange }) {
  const className = field.full ? 'sm:col-span-2' : '';
  if (field.type === 'select') {
    return (
      <div className={className}>
        <label className="label">{field.label}</label>
        <select
          className="input"
          value={value ?? ''}
          required={field.required}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">{field.required ? 'Choose...' : '(none)'}</option>
          {(field.options || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <div className={`${className} flex items-center gap-2`}>
        <input
          id={field.key}
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor={field.key} className="text-sm font-medium text-slate-700">
          {field.label}
        </label>
      </div>
    );
  }
  return (
    <div className={className}>
      <label className="label">{field.label}</label>
      <input
        type={field.type || 'text'}
        step={field.type === 'number' ? 'any' : undefined}
        className="input"
        value={value ?? ''}
        required={field.required}
        onChange={(e) => onChange(field.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
      />
    </div>
  );
}

function cleanPayload(form, fields) {
  const out = {};
  for (const f of fields) {
    let v = form[f.key];
    if (v === '' || v === undefined) v = null;
    if (f.type === 'select' && v !== null && f.valueType !== 'string') {
      v = Number(v);
    }
    out[f.key] = v;
  }
  return out;
}
