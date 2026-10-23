import React from 'react';
import './Switch.css';

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
  id,
  ...props
}: SwitchProps): React.ReactElement {
  function handleClick() {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      handleClick();
    }
  }

  return (
    <div className={`ui-switch-wrapper ${disabled ? 'ui-switch-wrapper--disabled' : ''} ${className}`.trim()}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        id={id}
        className={`ui-switch ${checked ? 'ui-switch--checked' : ''}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        <span className="ui-switch__thumb" aria-hidden="true" />
      </button>

      {(label || description) && (
        <div className="ui-switch__text" onClick={handleClick}>
          {label && <span className="ui-switch__label">{label}</span>}
          {description && <span className="ui-switch__desc">{description}</span>}
        </div>
      )}
    </div>
  );
}
