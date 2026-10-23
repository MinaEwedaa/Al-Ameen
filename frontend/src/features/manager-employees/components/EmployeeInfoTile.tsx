import type { ReactNode } from 'react';
import './EmployeeInfoTile.css';

interface EmployeeInfoTileProps {
  label: string;
  children: ReactNode;
}

// Small label + value card of the details drawer.
// TODO switch to the shared InfoTile from the manager shell once it is merged into Sprint-2.
export function EmployeeInfoTile({ label, children }: EmployeeInfoTileProps) {
  return (
    <div className="employee-info-tile">
      <span className="employee-info-tile__label">{label}</span>
      <strong className="employee-info-tile__value">{children}</strong>
    </div>
  );
}
