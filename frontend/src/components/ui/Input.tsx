import type { InputHTMLAttributes } from 'react';
import './Input.css';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...props }: InputProps) {
  return <input className={`ui-input ${className}`.trim()} {...props} />;
}
