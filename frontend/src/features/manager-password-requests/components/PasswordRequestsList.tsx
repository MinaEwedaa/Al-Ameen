import React from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import type { PasswordRequest } from '../types/password-request.types';
import { Avatar } from '../../../components/ui/Avatar';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatRequestDate, translateOr } from '../utils/requestLabels';
import './PasswordRequestsList.css';

interface PasswordRequestsListProps {
  requests: PasswordRequest[];
  onSelect: (id: string) => void;
  selectedId?: string | null;
}

export function PasswordRequestsList({
  requests,
  onSelect,
  selectedId,
}: PasswordRequestsListProps): React.ReactElement {
  const { language, t } = useLanguage();

  if (requests.length === 0) {
    return (
      <div className="pw-list-empty">
        <Inbox className="pw-list-empty__icon" aria-hidden="true" />
        <p className="pw-list-empty__text">{t('manager.passwordRequests.list.empty')}</p>
      </div>
    );
  }

  return (
    <div className="pw-list" role="list">
      {requests.map((item) => {
        const isSelected = item.id === selectedId;

        const roleLabel = translateOr(t, `manager.passwordRequests.roles.${item.role}`, item.role);

        // Names are data: shown as stored, never translated
        const employeeName = item.employeeName;

        return (
          <div
            key={item.id}
            role="listitem"
            tabIndex={0}
            className={`pw-card ${isSelected ? 'pw-card--selected' : ''}`}
            onClick={() => onSelect(item.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(item.id);
              }
            }}
          >
            <div className="pw-card__start">
              <Avatar
                name={employeeName}
                size="md"
                variant="primary"
                className="pw-card__avatar"
              />
              <div className="pw-card__info">
                <span className="pw-card__role">{roleLabel}</span>
                <strong className="pw-card__name">{employeeName}</strong>
                <span className="pw-card__date">{formatRequestDate(item.createdAt, language)}</span>
              </div>
            </div>

            <div className="pw-card__end">
              <span className={`pw-status pw-status--${item.status}`}>
                {t(`manager.passwordRequests.status.${item.status}`)}
              </span>

              {language === 'ar' ? (
                <ChevronLeft className="pw-card__chevron" aria-hidden="true" />
              ) : (
                <ChevronRight className="pw-card__chevron" aria-hidden="true" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
