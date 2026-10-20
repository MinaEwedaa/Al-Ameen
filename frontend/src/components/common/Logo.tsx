import logoUrl from '../../assets/images/al-amin-logo.png';
import './Logo.css';

interface LogoProps {
  className?: string;
}

export function Logo({ className = '' }: LogoProps) {
  return <img className={className} src={logoUrl} alt="Al-Amin Hotel" />;
}