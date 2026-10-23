import './StaffAvatar.css';

export interface StaffAvatarProps {
  letter: string;
  className?: string;
}

export function StaffAvatar({ letter, className = '' }: StaffAvatarProps) {
  return (
    <div className={`staff-avatar ${className}`.trim()} aria-hidden="true">
      {letter}
    </div>
  );
}
