import { useLanguage } from '../../core/i18n/useLanguage';
import { formatNumber } from '../../utils/format';
import './StackedStatusBar.css';

export type StatusBarSegmentTone =
  | 'primary'
  | 'success'
  | 'teal'
  | 'gold'
  | 'danger'
  | 'amber'
  | 'warning'
  | 'info'
  | 'purple'
  | 'neutral';

export interface StatusBarSegment {
  key: string;
  label: string;
  value: number;
  tone: StatusBarSegmentTone;
}

export interface StackedStatusBarProps {
  /** Array of status segments */
  segments: StatusBarSegment[];
  /** Optional explicit total; if omitted, sums segment values */
  total?: number;
  /** Whether to render the legend (default true) */
  showLegend?: boolean;
  /** Legend position relative to the bar: top or bottom (default bottom) */
  legendPosition?: 'bottom' | 'top';
  /** Optional custom height for the track (e.g. 16 or '1rem') */
  height?: number | string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** Additional CSS class names */
  className?: string;
}

export function StackedStatusBar({
  segments,
  total: explicitTotal,
  showLegend = true,
  legendPosition = 'bottom',
  height,
  ariaLabel,
  className = '',
}: StackedStatusBarProps) {
  const { language } = useLanguage();

  const computedTotal = segments.reduce((sum, s) => sum + (Number.isFinite(s.value) && s.value > 0 ? s.value : 0), 0);
  const total = explicitTotal ?? (computedTotal > 0 ? computedTotal : 1);

  const defaultAriaLabel = segments
    .map((s) => `${s.label}: ${formatNumber(s.value, language)}`)
    .join('، ');

  const trackStyle = height
    ? { height: typeof height === 'number' ? `${height}px` : height }
    : undefined;

  const legend = showLegend && (
    <div className="ui-stacked-status-bar__legend">
      {segments.map((seg) => (
        <span key={seg.key} className="ui-stacked-status-bar__legend-item">
          <i
            className={`ui-stacked-status-bar__legend-dot ui-stacked-status-bar__legend-dot--${seg.tone}`}
            aria-hidden="true"
          />
          <span className="ui-stacked-status-bar__legend-label">{seg.label}</span>
          <span className="ui-stacked-status-bar__legend-value">
            {formatNumber(seg.value, language)}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className={`ui-stacked-status-bar ${className}`.trim()} role="group" aria-label={ariaLabel ?? defaultAriaLabel}>
      {legendPosition === 'top' && legend}

      <div className="ui-stacked-status-bar__track" style={trackStyle}>
        {segments.map((seg) => {
          const val = Math.max(0, Number.isFinite(seg.value) ? seg.value : 0);
          const percent = total > 0 ? (val / total) * 100 : 0;
          if (percent <= 0) return null;

          return (
            <div
              key={seg.key}
              className={`ui-stacked-status-bar__segment ui-stacked-status-bar__segment--${seg.tone}`}
              style={{ width: `${percent}%` }}
              title={`${seg.label}: ${formatNumber(val, language)} (${Math.round(percent)}%)`}
              role="img"
              aria-label={`${seg.label}: ${formatNumber(val, language)}`}
            />
          );
        })}
      </div>

      {legendPosition === 'bottom' && legend}
    </div>
  );
}
