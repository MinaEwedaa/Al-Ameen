import { KeyRound } from 'lucide-react';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useToast } from '../../../components/ui/ToastContext';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { EMPLOYEES_I18N } from '../constants/employees.constants';

interface TemporaryPasswordDialogProps {
  name: string;
  password: string;
  /** "created" after onboarding, "reset" after a manager reset */
  reason: 'created' | 'reset';
  onClose: () => void;
}

// The server-generated password is shown once, right after POST /staff or reset-password
export function TemporaryPasswordDialog({ name, password, reason, onClose }: TemporaryPasswordDialogProps) {
  const { t: translate } = useLanguage();
  const t = (key: string) => translate(`${EMPLOYEES_I18N}.${key}`);
  const toast = useToast();

  async function copyAndClose() {
    try {
      await navigator.clipboard.writeText(password);
      toast.notify(t('passwordCopied'), 'success');
    } catch {
      toast.notify(t('passwordCopyFailed'), 'warning');
    }
    onClose();
  }

  return (
    <ConfirmDialog
      icon={<KeyRound />}
      title={t(reason === 'created' ? 'passwordDialogCreatedTitle' : 'passwordDialogResetTitle').replace('{name}', name)}
      description={t('passwordDialogText').replace('{password}', password)}
      confirmLabel={t('copyAndClose')}
      cancelLabel={t('close')}
      onConfirm={() => { void copyAndClose(); }}
      onCancel={onClose}
    />
  );
}
