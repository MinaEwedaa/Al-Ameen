import type { InputHTMLAttributes } from 'react';
import './RoomTypeDrawers.css';

interface RoomTypeFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  id: string;
  label: string;
  value: string;
  /** Small unit inside the input, e.g. "ج.م / ليلة" */
  suffix?: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
}

// One labeled input of the room type drawers, with the error under it
export function RoomTypeField({ id, label, value, suffix, error, hint, onChange, ...props }: RoomTypeFieldProps) {
  return (
    <label className="room-type-form__field" htmlFor={id}>
      <span>{label}</span>
      <span className={suffix ? 'room-type-form__money' : undefined}>
        <input
          {...props}
          id={id}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={error ? 'room-type-form__control--error' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <small>{suffix}</small>}
      </span>
      {error
        ? <span id={`${id}-error`} className="room-type-form__error">{error}</span>
        : hint && <span id={`${id}-hint`} className="room-type-form__hint">{hint}</span>}
    </label>
  );
}
