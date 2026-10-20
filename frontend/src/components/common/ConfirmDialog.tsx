import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  /** Optional icon shown in a soft green square above the title (centered layout, as in the prototype) */
  icon?: ReactNode;
  /** Disables the confirm button (e.g. while saving) */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  icon,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="ui-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className={`ui-dialog${icon ? ' ui-dialog--centered' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {icon && <span className="ui-dialog__icon" aria-hidden="true">{icon}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        <div className="ui-dialog__actions">
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button className={variant === 'danger' ? 'ui-button--danger' : ''} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
