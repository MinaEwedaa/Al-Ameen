import type { CSSProperties, ReactNode } from 'react';
import { SearchBar } from './SearchBar';
import './FilterBar.css';

interface FilterBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  children?: ReactNode;
  className?: string;
  /**
   * Number of equal-width fields including the search box (search + selects).
   * When set, the bar becomes the shared filters grid: equal columns + a reset link at the end.
   */
  columns?: number;
  /** Shows the shared "reset" text link at the end of the bar */
  onReset?: () => void;
  resetLabel?: string;
}

export function FilterBar({ value, onChange, placeholder, children, className = '', columns, onReset, resetLabel }: FilterBarProps) {
  const style = columns ? ({ '--filter-columns': columns } as CSSProperties) : undefined;
  return (
    <div className={`filter-bar${columns ? ' filter-bar--grid' : ''} ${className}`.trim()} style={style}>
      <SearchBar value={value} onChange={onChange} placeholder={placeholder} />
      {children}
      {onReset && (
        <button type="button" className="filter-bar__reset" onClick={onReset}>
          {resetLabel}
        </button>
      )}
    </div>
  );
}
