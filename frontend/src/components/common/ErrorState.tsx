import type { ReactNode } from 'react';
import './ErrorState.css';

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

export function ErrorState({ title = 'Unable to load this page', message, action }: ErrorStateProps) {
  return <div className="ui-error-state"><strong>{title}</strong><p>{message}</p>{action && <div className="ui-state-action">{action}</div>}</div>;
}
