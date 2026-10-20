import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** `gold` and `glass` are the two hero buttons (main action / secondary action on the green banner). */
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold' | 'glass';
}

export function Button({ children, variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={`ui-button ui-button--${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
