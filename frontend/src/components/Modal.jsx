export default function Modal({ open, title, children, onClose, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} rounded-lg bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              X
            </button>
          )}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
