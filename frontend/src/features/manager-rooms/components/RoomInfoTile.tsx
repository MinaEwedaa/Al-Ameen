import type { ReactNode } from 'react';
import './RoomInfoTile.css';

export interface RoomInfoTileProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function RoomInfoTile({ label, value, className = '' }: RoomInfoTileProps) {
  return (
    <div className={`room-info-tile ${className}`.trim()}>
      <span className="room-info-tile__label">{label}</span>
      <strong className="room-info-tile__value">{value}</strong>
    </div>
  );
}
