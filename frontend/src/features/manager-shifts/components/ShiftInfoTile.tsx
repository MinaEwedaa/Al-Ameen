import type { ReactNode } from 'react';
import './ShiftInfoTile.css';

interface ShiftInfoTileProps {
  label: string;
  children: ReactNode;
}

// Small label + value card of the shift cards and drawers.
// TODO switch to the shared InfoTile from the manager shell once it is merged into Sprint-2.
export function ShiftInfoTile({ label, children }: ShiftInfoTileProps) {
  return (
    <div className="shift-info-tile">
      <span className="shift-info-tile__label">{label}</span>
      <strong className="shift-info-tile__value">{children}</strong>
    </div>
  );
}
