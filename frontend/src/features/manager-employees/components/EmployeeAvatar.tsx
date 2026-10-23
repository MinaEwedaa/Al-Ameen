import { avatarLetter } from '../utils/employeeDisplay';
import './EmployeeAvatar.css';

interface EmployeeAvatarProps {
  name: string;
  /** sm = table rows, lg = drawer summary */
  size?: 'sm' | 'lg';
}

// Rounded square with the first letter of the name.
// TODO switch to the shared Avatar from the manager shell once it is merged into Sprint-2.
export function EmployeeAvatar({ name, size = 'sm' }: EmployeeAvatarProps) {
  return (
    <span className={`employee-avatar employee-avatar--${size}`} aria-hidden="true">
      {avatarLetter(name)}
    </span>
  );
}
