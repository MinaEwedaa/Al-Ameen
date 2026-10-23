import './ProgressBar.css';

export type ProgressBarTone = 'success' | 'gold' | 'danger';

export interface ProgressBarProps {
  /** Progress percentage between 0 and 100 */
  value: number;
  /** Optional descriptive label */
  label?: string;
  /** Optional formatted value text (e.g. "72%") */
  valueText?: string;
  /** Visual tone (defaults to success) */
  tone?: ProgressBarTone;
  /** Layout orientation: stacked (default) or inline (label - bar - value) */
  layout?: 'stacked' | 'inline';
  /** Track height size: sm (6px), md (8px), lg (12px) */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label if neither label nor valueText is provided */
  ariaLabel?: string;
  /** Additional CSS class names */
  className?: string;
}

export function ProgressBar({
  value,
  label,
  valueText,
  tone = 'success',
  layout = 'stacked',
  size = 'md',
  ariaLabel,
  className = '',
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const displayText = valueText ?? `${clampedValue}%`;
  const accessibleLabel = ariaLabel ?? label ?? displayText;

  const track = (
    <div
      className="ui-progress-bar__track"
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={accessibleLabel}
      aria-valuetext={displayText}
    >
      <div
        className="ui-progress-bar__fill"
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );

  const containerClasses = [
    'ui-progress-bar',
    `ui-progress-bar--${tone}`,
    `ui-progress-bar--${size}`,
    layout === 'inline' ? 'ui-progress-bar--inline' : 'ui-progress-bar--stacked',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (layout === 'inline') {
    return (
      <div className={containerClasses}>
        {label && <span className="ui-progress-bar__label">{label}</span>}
        {track}
        {displayText && <span className="ui-progress-bar__value">{displayText}</span>}
      </div>
    );
  }

  const hasHeader = Boolean(label || valueText);

  return (
    <div className={containerClasses}>
      {hasHeader && (
        <div className="ui-progress-bar__header">
          {label && <span className="ui-progress-bar__label">{label}</span>}
          {valueText && <span className="ui-progress-bar__value">{valueText}</span>}
        </div>
      )}
      {track}
    </div>
  );
}
