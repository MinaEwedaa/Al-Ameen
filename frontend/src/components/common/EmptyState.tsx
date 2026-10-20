import type { ReactNode } from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return <div className="ui-empty-state"><strong>{title}</strong>{description && <p>{description}</p>}{action && <div className="ui-state-action">{action}</div>}</div>;
}
