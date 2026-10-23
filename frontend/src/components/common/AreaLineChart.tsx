import { useId } from 'react';
import './AreaLineChart.css';

export interface AreaLineChartProps {
  /** Array of numeric data values to plot */
  points: number[];
  /** Array of labels corresponding to each point (rendered along x-axis) */
  labels?: string[];
  /** Chart height in pixels (defaults to 180) */
  height?: number;
  /** Accessible description for screen readers */
  ariaLabel?: string;
  /** Additional CSS class names */
  className?: string;
}

interface Point2D {
  x: number;
  y: number;
}

function calculateControlPoint(
  current: Point2D,
  previous: Point2D | undefined,
  next: Point2D | undefined,
  reverse = false,
): Point2D {
  const p = previous ?? current;
  const n = next ?? current;
  const smoothing = 0.18;
  const oX = n.x - p.x;
  const oY = n.y - p.y;
  const angle = Math.atan2(oY, oX) + (reverse ? Math.PI : 0);
  const length = Math.sqrt(oX * oX + oY * oY) * smoothing;
  return {
    x: current.x + Math.cos(angle) * length,
    y: current.y + Math.sin(angle) * length,
  };
}

function buildSmoothPath(points: Point2D[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const cpStart = calculateControlPoint(points[i - 1], points[i - 2], points[i]);
    const cpEnd = calculateControlPoint(points[i], points[i - 1], points[i + 1], true);
    path += ` C ${cpStart.x.toFixed(1)},${cpStart.y.toFixed(1)} ${cpEnd.x.toFixed(1)},${cpEnd.y.toFixed(1)} ${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`;
  }
  return path;
}

export function AreaLineChart({
  points,
  labels = [],
  height = 180,
  ariaLabel = 'مخطط بياني للمؤشرات المالية',
  className = '',
}: AreaLineChartProps) {
  const gradientId = useId();

  if (!points || points.length === 0) {
    return (
      <div className={`common-area-line-chart ${className}`.trim()} role="img" aria-label={ariaLabel}>
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            لا توجد بيانات متاحة
          </span>
        </div>
      </div>
    );
  }

  const viewBoxWidth = 500;
  const viewBoxHeight = height;

  const padTop = 18;
  const padBottom = labels.length > 0 ? 32 : 16;
  const padLeft = 20;
  const padRight = 20;

  const plotWidth = viewBoxWidth - padLeft - padRight;
  const plotHeight = viewBoxHeight - padTop - padBottom;

  const rawMin = Math.min(...points);
  const rawMax = Math.max(...points);
  // Add a 10% breathing room to min and max so the line doesn't hug boundaries
  const valueRange = rawMax - rawMin || 1;
  const minVal = Math.max(0, rawMin - valueRange * 0.12);
  const maxVal = rawMax + valueRange * 0.12;
  const range = maxVal - minVal;

  const coords: Point2D[] = points.map((val, idx) => {
    const x = points.length === 1
      ? padLeft + plotWidth / 2
      : padLeft + (idx / (points.length - 1)) * plotWidth;
    const y = padTop + plotHeight - ((val - minVal) / range) * plotHeight;
    return { x, y };
  });

  const linePath = buildSmoothPath(coords);

  const baselineY = padTop + plotHeight;
  const firstPoint = coords[0];
  const lastPoint = coords[coords.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} ${baselineY.toFixed(1)} L ${firstPoint.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;

  // 3 horizontal light dotted grid lines
  const gridLines = [0.2, 0.5, 0.8].map((ratio) => padTop + plotHeight * ratio);

  return (
    <div className={`common-area-line-chart ${className}`.trim()}>
      <svg
        className="common-area-line-chart__svg"
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
            <stop offset="65%" stopColor="var(--color-primary)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--color-chart-area)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Light dotted grid lines */}
        {gridLines.map((y, index) => (
          <line
            key={index}
            x1={padLeft}
            y1={y}
            x2={viewBoxWidth - padRight}
            y2={y}
            className="common-area-line-chart__grid-line"
          />
        ))}

        {/* Soft area fill */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Smooth line */}
        <path d={linePath} className="common-area-line-chart__line" />

        {/* End-point marker */}
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={6}
          className="common-area-line-chart__marker-ring"
        />
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={3}
          className="common-area-line-chart__marker-dot"
        />

        {/* X-axis labels */}
        {labels.map((lbl, idx) => {
          if (!lbl) return null;
          const x = points.length === 1
            ? padLeft + plotWidth / 2
            : padLeft + (idx / (points.length - 1)) * plotWidth;
          return (
            <text
              key={idx}
              x={x}
              y={baselineY + 8}
              textAnchor="middle"
              className="common-area-line-chart__label"
            >
              {lbl}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
