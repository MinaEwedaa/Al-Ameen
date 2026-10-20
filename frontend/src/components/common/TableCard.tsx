import type { ReactNode } from 'react';
import { Card } from '../ui/Card';
import './TableCard.css';

interface TableCardProps {
  title: string;
  subtitle?: string;
  /** Small green pill at the end of the header (e.g. "12 tasks shown") */
  badge?: ReactNode;
  /** Usually the shared <Pagination> */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

// The list card used on every page: title + subtitle + count pill, the table, then the pagination strip.
export function TableCard({ title, subtitle, badge, footer, children, className = '' }: TableCardProps) {
  return (
    <Card className={`table-card ${className}`.trim()}>
      <header className="table-card__header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {badge !== undefined && badge !== null && <span className="table-card__count">{badge}</span>}
      </header>
      <div className="table-card__body">{children}</div>
      {footer && <footer className="table-card__footer">{footer}</footer>}
    </Card>
  );
}
