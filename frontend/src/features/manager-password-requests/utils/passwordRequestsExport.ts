import { exportCsv, type CsvColumn } from '../../../utils/exportCsv';
import type { PasswordRequest } from '../types/password-request.types';
import type { Language } from '../../../core/i18n';
import { getTranslation } from '../../../core/i18n';

export function exportPasswordRequestsCsv(
  requests: PasswordRequest[],
  language: Language,
): boolean {
  const t = (key: string) => getTranslation(language, `manager.passwordRequests.${key}`);

  const columns: CsvColumn<PasswordRequest>[] = [
    { header: t('table.id'), value: (r) => r.id },
    { header: t('table.employee'), value: (r) => r.employeeName },
    { header: t('table.username'), value: (r) => r.username },
    { header: t('table.role'), value: (r) => r.role },
    { header: t('table.status'), value: (r) => t(`status.${r.status}`) },
    { header: t('table.date'), value: (r) => r.createdAt },
    { header: t('table.reason'), value: (r) => r.reason },
  ];

  const dateStr = new Date().toISOString().split('T')[0];
  return exportCsv(requests, columns, `password-requests-${dateStr}.csv`);
}
