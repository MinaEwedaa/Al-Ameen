import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  error?: string;
  id?: string;
  className?: string;
  autoOpen?: boolean;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export function Select({ value, options, onChange, placeholder = '', label, disabled = false, error, id, className = '', autoOpen = false }: SelectProps) {
  const generatedId = useId();
  const controlId = id ?? `select-${generatedId}`;
  const listId = `${controlId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const selected = options.find((option) => option.value === value);
  const enabledIndexes = options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);

  const placeMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const maxHeight = Math.min(280, window.innerHeight - 32);
    const menuHeight = Math.min(maxHeight, options.length * 40 + 12);
    const top = window.innerHeight - rect.bottom >= menuHeight + 6
      ? rect.bottom + 6
      : Math.max(16, rect.top - menuHeight - 6);
    setPosition({ top, left: rect.left, width: rect.width, maxHeight });
  }, [options.length]);

  const openMenu = useCallback((index = Math.max(0, options.findIndex((option) => option.value === value))) => {
    const nextIndex = enabledIndexes.includes(index) ? index : enabledIndexes[0] ?? 0;
    setActiveIndex(nextIndex);
    setOpen(true);
  }, [enabledIndexes, options, value]);

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
  }, [open, placeMenu]);

  useEffect(() => {
    if (open && position) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open, position]);

  useEffect(() => {
    if (autoOpen && !open && !disabled) openMenu();
  }, [autoOpen, disabled, open, openMenu]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !document.getElementById(listId)?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const reposition = () => placeMenu();
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [listId, open, placeMenu]);

  const moveActive = (direction: 1 | -1) => {
    if (enabledIndexes.length === 0) return;
    const currentPosition = enabledIndexes.indexOf(activeIndex);
    const nextPosition = (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPosition] ?? 0);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const selectedIndex = options.findIndex((option) => option.value === value);
      openMenu(event.key === 'ArrowDown' ? Math.max(0, selectedIndex) : enabledIndexes.at(-1));
    }
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(enabledIndexes[0] ?? 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(enabledIndexes.at(-1) ?? 0);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option && !option.disabled) {
        onChange(option.value);
        setOpen(false);
        triggerRef.current?.focus();
      }
    } else if (event.key === 'Tab') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div className={`ui-select ${className}`.trim()} ref={rootRef}>
      {label && <label className="ui-select__label" id={`${controlId}-label`}>{label}</label>}
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        className={`ui-select__trigger${error ? ' ui-select__trigger--error' : ''}`}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-labelledby={label ? `${controlId}-label` : undefined}
        aria-label={label}
        aria-describedby={error ? `${controlId}-error` : undefined}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={selected ? '' : 'ui-select__placeholder'}>{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden="true" className="ui-select__chevron" />
      </button>
      {error && <span className="ui-select__error" id={`${controlId}-error`}>{error}</span>}
      {open && position && createPortal(
        <div
          id={listId}
          className="ui-select__listbox"
          role="listbox"
          aria-labelledby={label ? `${controlId}-label` : undefined}
          style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}
          dir={document.documentElement.dir}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              id={`${listId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`ui-select__option${option.value === value ? ' ui-select__option--selected' : ''}`}
              disabled={option.disabled}
              tabIndex={index === activeIndex ? 0 : -1}
              onMouseEnter={() => setActiveIndex(index)}
              onKeyDown={handleOptionKeyDown}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
