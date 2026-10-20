import type { ReactNode } from 'react';
import './PageHero.css';

interface PageHeroProps {
  title: string;
  eyebrow?: string;
  description?: string;
  /** Hero buttons. Use <Button variant="gold"> for the main action and variant="glass" for secondary ones. */
  children?: ReactNode;
  /** `brand` = the green banner used across the app (default). `plain` = title on the page background. */
  variant?: 'brand' | 'plain';
  className?: string;
}

export function PageHero({ title, eyebrow, description, children, variant = 'brand', className = '' }: PageHeroProps) {
  return (
    <section className={`page-hero page-hero--${variant} ${className}`.trim()}>
      <div className="page-hero__copy">
        {eyebrow && <span className="page-hero__eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-hero__actions">{children}</div>}
    </section>
  );
}
