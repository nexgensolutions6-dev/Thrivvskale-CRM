import { X } from 'lucide-react';
import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'modal' | 'drawer';
}

/** Built on <dialog>, which gives focus trapping, Esc to close and stacking for free. */
export function Modal({ title, onClose, children, variant = 'modal' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const closeOnBackdrop = (event: MouseEvent) => {
    if (event.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${variant}`}
      aria-label={title}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={closeOnBackdrop}
    >
      <div className="dialog-body">
        <header className="dialog-header">
          <h2>{title}</h2>
          <button className="icon-btn icon-btn-plain" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

interface ConfirmProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose, busy }: ConfirmProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="confirm-text">{message}</p>
      <div className="form-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
