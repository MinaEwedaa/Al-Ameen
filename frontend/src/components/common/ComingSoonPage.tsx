import { Clock } from 'lucide-react';
import { useLanguage } from '../../core/i18n/useLanguage';
import './ComingSoonPage.css';

interface ComingSoonPageProps {
  title?: string;
  description?: string;
}

export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  const { t } = useLanguage();

  return (
    <div className="coming-soon-container">
      <div className="coming-soon-card">
        <div className="coming-soon-badge">
          <Clock className="coming-soon-badge__icon" aria-hidden="true" />
        </div>
        <h1 className="coming-soon-title">
          {title ?? t('manager.shell.comingSoon.title')}
        </h1>
        <p className="coming-soon-desc">
          {description ?? t('manager.shell.comingSoon.description')}
        </p>
      </div>
    </div>
  );
}
