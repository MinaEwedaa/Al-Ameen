import type { ReactNode } from 'react';
import './RoomTypeStat.css';

interface RoomTypeStatProps {
  label: string;
  children: ReactNode;
}

// Small label + value tile under each room type card.
// TODO switch to the shared InfoTile from the manager shell once it is merged into Sprint-2.
export function RoomTypeStat({ label, children }: RoomTypeStatProps) {
  return (
    <div className="room-type-stat">
      <span className="room-type-stat__label">{label}</span>
      <strong className="room-type-stat__value">{children}</strong>
    </div>
  );
}
