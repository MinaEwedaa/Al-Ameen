import React from 'react';
import './SegmentedControl.css';

export interface SegmentedControlOption {
  value: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  name,
  disabled = false,
  size = 'md',
  className = '',
}: SegmentedControlProps): React.ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={`ui-segmented-control ui-segmented-control--${size} ${
        disabled ? 'ui-segmented-control--disabled' : ''
      } ${className}`.trim()}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const isOptionDisabled = disabled || option.disabled;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isOptionDisabled}
            className={`ui-segmented-control__item ${
              isSelected ? 'ui-segmented-control__item--active' : ''
            }`}
            onClick={() => {
              if (!isOptionDisabled && option.value !== value) {
                onChange(option.value);
              }
            }}
          >
            {Icon && <Icon className="ui-segmented-control__icon" aria-hidden="true" />}
            <span className="ui-segmented-control__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
