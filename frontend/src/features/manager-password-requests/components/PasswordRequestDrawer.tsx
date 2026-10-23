import React, { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import type { PasswordRequest } from '../types/password-request.types';
import { Drawer } from '../../../components/ui/Drawer';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { useToast } from '../../../components/ui/ToastContext';
import { generateTemporaryPassword } from '../utils/passwordGenerator';
import { approvePasswordRequest, rejectPasswordRequest } from '../services/password-requests.api';
import './PasswordRequestDrawer.css';

interface PasswordRequestDrawerProps {
  request: PasswordRequest | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (updated: PasswordRequest) => void;
}

export function PasswordRequestDrawer({
  request,
  open,
  onClose,
  onUpdated,
}: PasswordRequestDrawerProps): React.ReactElement | null {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  useEffect(() => {
    if (request) {
      setTempPassword(request.tempPassword || generateTemporaryPassword());
      setCopied(false);
      setShowRejectConfirm(false);
    }
  }, [request]);

  if (!request) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      showToast(t('manager.passwordRequests.drawer.copiedToast'), 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t('manager.passwordRequests.drawer.copyFailed'), 'warning');
    }
  }

  function handleRegenerate() {
    setTempPassword(generateTemporaryPassword());
    setCopied(false);
  }

  async function handleApprove() {
    if (!request || submitting) return;
    setSubmitting(true);
    try {
      const updated = await approvePasswordRequest(request.id, tempPassword);
      showToast(t('manager.passwordRequests.drawer.approveSuccess'), 'success');
      onUpdated(updated);
      onClose();
    } catch {
      showToast(t('manager.passwordRequests.drawer.actionError'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmReject() {
    if (!request || submitting) return;
    setSubmitting(true);
    try {
      const updated = await rejectPasswordRequest(request.id);
      showToast(t('manager.passwordRequests.drawer.rejectSuccess'), 'info');
      onUpdated(updated);
      setShowRejectConfirm(false);
      onClose();
    } catch {
      showToast(t('manager.passwordRequests.drawer.actionError'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const isResolved = request.status === 'approved' || request.status === 'rejected';

  const roleLabel =
    request.role === 'ريسبشنيست' || request.role === 'receptionist'
      ? t('manager.passwordRequests.roles.receptionist')
      : request.role === 'فني صيانة' || request.role === 'maintenance'
        ? t('manager.passwordRequests.roles.maintenance')
        : request.role;

  const employeeName =
    t(`manager.passwordRequests.employees.${request.id}`) || request.employeeName;

  const reason =
    t(`manager.passwordRequests.reasons.${request.id}`) || request.reason;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        eyebrow={t('manager.passwordRequests.drawer.eyebrow')}
        title={employeeName}
        className="pw-drawer"
        footer={
          !isResolved ? (
            <div className="pw-drawer__actions">
              <button
                type="button"
                className="pw-drawer__btn pw-drawer__btn--approve"
                onClick={handleApprove}
                disabled={submitting}
              >
                {submitting
                  ? t('loading')
                  : t('manager.passwordRequests.drawer.approve')}
              </button>

              <button
                type="button"
                className="pw-drawer__btn pw-drawer__btn--reject"
                onClick={() => setShowRejectConfirm(true)}
                disabled={submitting}
              >
                {t('manager.passwordRequests.drawer.reject')}
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="pw-drawer__grid">
          <div className="pw-drawer__field">
            <span className="pw-drawer__label">{t('manager.passwordRequests.drawer.role')}</span>
            <div className="pw-drawer__box">{roleLabel}</div>
          </div>

          <div className="pw-drawer__field">
            <span className="pw-drawer__label">{t('manager.passwordRequests.drawer.username')}</span>
            <div className="pw-drawer__box">{request.username}</div>
          </div>

          <div className="pw-drawer__field">
            <span className="pw-drawer__label">{t('manager.passwordRequests.drawer.status')}</span>
            <div className="pw-drawer__box">
              <span className={`pw-status pw-status--${request.status}`}>
                {t(`manager.passwordRequests.status.${request.status}`)}
              </span>
            </div>
          </div>

          <div className="pw-drawer__field">
            <span className="pw-drawer__label">{t('manager.passwordRequests.drawer.date')}</span>
            <div className="pw-drawer__box">{request.createdAt}</div>
          </div>

          <div className="pw-drawer__field pw-drawer__field--full">
            <span className="pw-drawer__label">{t('manager.passwordRequests.drawer.reason')}</span>
            <div className="pw-drawer__box pw-drawer__box--multiline">
              {reason}
            </div>
          </div>

          {!isResolved && (
            <div className="pw-drawer__field pw-drawer__field--full">
              <div className="pw-drawer__label-row">
                <span className="pw-drawer__label">
                  {t('manager.passwordRequests.drawer.tempPassword')}
                </span>
                <button
                  type="button"
                  className="pw-drawer__text-action"
                  onClick={handleRegenerate}
                >
                  <RefreshCw className="pw-drawer__action-icon" aria-hidden="true" />
                  <span>{t('manager.passwordRequests.drawer.generate')}</span>
                </button>
              </div>

              <div className="pw-drawer__password-wrap">
                <input
                  type="text"
                  readOnly
                  value={tempPassword}
                  className="pw-drawer__password-input"
                />
                <button
                  type="button"
                  className="pw-drawer__copy-btn"
                  onClick={handleCopy}
                  title={t('manager.passwordRequests.drawer.copy')}
                  aria-label={t('manager.passwordRequests.drawer.copy')}
                >
                  {copied ? (
                    <Check className="pw-drawer__copy-icon pw-drawer__copy-icon--success" aria-hidden="true" />
                  ) : (
                    <Copy className="pw-drawer__copy-icon" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </Drawer>

      {showRejectConfirm && (
        <ConfirmDialog
          variant="danger"
          title={t('manager.passwordRequests.confirmReject.title')}
          description={t('manager.passwordRequests.confirmReject.description')}
          confirmLabel={t('manager.passwordRequests.confirmReject.confirm')}
          cancelLabel={t('manager.passwordRequests.confirmReject.cancel')}
          busy={submitting}
          onConfirm={handleConfirmReject}
          onCancel={() => setShowRejectConfirm(false)}
        />
      )}
    </>
  );
}
