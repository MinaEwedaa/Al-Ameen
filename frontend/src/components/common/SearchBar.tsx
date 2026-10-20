import { Search } from 'lucide-react';
import { Input } from '../ui/Input';
import './SearchBar.css';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder, ariaLabel, className = '' }: SearchBarProps) {
  return (
    <label className={`common-search ${className}`.trim()}>
      <Search aria-hidden="true" />
      <Input aria-label={ariaLabel ?? placeholder} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}
