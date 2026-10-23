import React from 'react';
import './InfoTile.css';

export interface InfoTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  subvalue?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  badge?: React.ReactNode;
  trend?: {
    text: string;
    positive?: boolean;
  };
  variant?: 'default' | 'soft' | 'muted';
  className?: string;
}

export function InfoTile({
  label,
  value,
  subvalue,
  icon: Icon,
  badge,
  trend,
  variant = 'default',
  className = '',
  ...props
}: InfoTileProps): React.ReactElement {
  return (
    <div className={`ui-info-tile ui-info-tile--${variant} ${className}`.trim()} {...props}>
      <div className="ui-info-tile__header">
        <span className="ui-info-tile__label">{label}</span>
        {badge && <span className="ui-info-tile__badge">{badge}</span>}
        {Icon && (
          <div className="ui-info-tile__icon-wrap">
            <Icon className="ui-info-tile__icon" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="ui-info-tile__body">
        <span className="ui-info-tile__value">{value}</span>
        {trend && (
          <span
            className={`ui-info-tile__trend ui-info-tile__trend--${
              trend.positive ? 'positive' : 'negative'
            }`}
          >
            {trend.text}
          </span>
        )}
      </div>

      {subvalue && <div className="ui-info-tile__subvalue">{subvalue}</div>}
    </div>
  );
}
