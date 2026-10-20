import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { normalizeDigits } from '../../utils/digits';
import './Combobox.css';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  id: string;
  label: string;
  /** Current value: an option's value once picked, otherwise what the user typed (digits normalized to 0-9) */
  value: string;
  options: ComboboxOption[];
  placeholder: string;
  noResultsLabel: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  inputMode?: 'text' | 'numeric';
}

const matches = (option: ComboboxOption, query: string) =>
  normalizeDigits(option.value).toLocaleLowerCase().includes(query)
  || normalizeDigits(option.label).toLocaleLowerCase().includes(query);

// Pick from the list, or type directly; the list narrows while typing (e.g. a room number).
export function Combobox({ id, label, value, options, placeholder, noResultsLabel, onChange, error, disabled, inputMode = 'text' }: ComboboxProps) {
  const listId = `${id}-listbox`;
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => options.find((option) => option.value === value)?.label ?? value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const query = normalizeDigits(text.trim()).toLocaleLowerCase();
  // Once an option is picked the field shows its label, so the full list stays available when reopened
  const picked = options.find((option) => option.value === value && option.label === text);
  const visible = picked || !query ? options : options.filter((option) => matches(option, query));

  const pick = (option: ComboboxOption) => {
    setText(option.label);
    onChange(option.value);
    setOpen(false);
  };

  const handleTyping = (next: string) => {
    setText(next);
    onChange(normalizeDigits(next.trim()));
    setActiveIndex(0);
    setOpen(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      if (visible.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + step + visible.length) % visible.length);
    } else if (event.key === 'Enter' && open) {
      // Enter picks the highlighted option instead of submitting the form
      event.preventDefault();
      const option = visible[activeIndex];
      if (option) pick(option);
    } else if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };

  const showList = open && !disabled;
  const optionId = (option: ComboboxOption) => `${listId}-${option.value}`;

  return (
    <div className="ui-combobox">
      <label className="ui-combobox__label" id={labelId} htmlFor={id}>{label}</label>
      <div className="ui-combobox__field">
        <div className={`ui-combobox__control${error ? ' ui-combobox__control--error' : ''}${showList ? ' ui-combobox__control--open' : ''}`}>
          <input
            ref={inputRef}
            id={id}
            type="text"
            inputMode={inputMode}
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={showList && visible[activeIndex] ? optionId(visible[activeIndex]) : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            placeholder={placeholder}
            value={text}
            disabled={disabled}
            onChange={(event) => handleTyping(event.target.value)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="ui-combobox__toggle"
            tabIndex={-1}
            aria-hidden="true"
            disabled={disabled}
            // Keep focus in the input so the list does not close on mousedown
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => { setOpen((current) => !current); inputRef.current?.focus(); }}
          >
            <ChevronDown />
          </button>
        </div>

        {showList && (
          <ul className="ui-combobox__list" id={listId} role="listbox" aria-labelledby={labelId}>
            {visible.length === 0 ? (
              <li className="ui-combobox__empty" role="presentation">{noResultsLabel}</li>
            ) : visible.map((option, index) => (
              <li
                key={option.value}
                id={optionId(option)}
                role="option"
                aria-selected={option.value === value}
                className={[
                  'ui-combobox__option',
                  option.value === value ? 'ui-combobox__option--selected' : '',
                  index === activeIndex ? 'ui-combobox__option--active' : '',
                ].filter(Boolean).join(' ')}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(option)}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <span className="ui-combobox__error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}
