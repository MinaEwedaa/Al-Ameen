import React, { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import type { PasswordRequest } from '../types/password-request.types';
import { Drawer } from '../../../components/ui/Drawer';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatRequestDate, translateOr } from '../utils/requestLabels';
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
  const { language, t } = useLanguage();
  const { showToast } = useToast();

  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [approvedHandout, setApprovedHandout] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      setTempPassword(request.tempPassword || generateTemporaryPassword());
      setCopied(false);
      setShowRejectConfirm(false);
      setApprovedHandout(null);
    }
  }, [request]);

  if (!request) return null;

  async function handleCopy(pwToCopy?: string) {
    const text = pwToCopy || tempPassword;
    try {
      await navigator.clipboard.writeText(text);
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
      setApprovedHandout(updated.tempPassword || tempPassword);
    } catch (err) {
      console.error('Failed to approve password request:', err);
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
      showToast(msg || t('manager.passwordRequests.drawer.actionError'), 'error');
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

  const isResolved = request.status === 'approved' || request.status === 'rejected' || approvedHandout !== null;
  const currentStatus = approvedHandout ? 'approved' : request.status;
  const roleLabel = translateOr(t, `manager.passwordRequests.roles.${request.role}`, request.role);
  const employeeName = request.employeeName;
  const reason = request.reason;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        eyebrow={t('manager.passwordRequests.drawer.eyebrow')}
        title={employeeName}
        className="pw-drawer"
        footer={
          approvedHandout ? (
            <div className="pw-drawer__actions" style={{ gridTemplateColumns: '1fr' }}>
              <button
                type="button"
                className="pw-drawer__btn pw-drawer__btn--approve"
                onClick={onClose}
              >
                {t('manager.passwordRequests.drawer.done')}
              </button>
            </div>
          ) : !isResolved ? (
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
              <span className={`pw-status pw-status--${currentStatus}`}>
                {t(`manager.passwordRequests.status.${currentStatus}`)}
              </span>
            </div>
          </div>

          <div className="pw-drawer__field">
            <span className="pw-drawer__label">{t('manager.passwordRequests.drawer.date')}</span>
            <div className="pw-drawer__box">{formatRequestDate(request.createdAt, language)}</div>
          </div>

          {reason ? (
            <div className="pw-drawer__field pw-drawer__field--full">
              <span className="pw-drawer__label">{t('manager.passwordRequests.drawer.reason')}</span>
              <div className="pw-drawer__box pw-drawer__box--multiline">
                {reason}
              </div>
            </div>
          ) : null}

          {approvedHandout ? (
            <div className="pw-drawer__handout">
              <div className="pw-drawer__handout-header">
                <Check className="pw-drawer__action-icon" aria-hidden="true" />
                <span>{t('manager.passwordRequests.drawer.handoutTitle')}</span>
              </div>
              <p className="pw-drawer__handout-desc">
                {t('manager.passwordRequests.drawer.handoutSubtitle')}
              </p>
              <div className="pw-drawer__handout-pw-box">
                <span className="pw-drawer__handout-pw-text">{approvedHandout}</span>
                <button
                  type="button"
                  className="pw-drawer__handout-copy-btn"
                  onClick={() => handleCopy(approvedHandout)}
                >
                  {copied ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Copy size={16} aria-hidden="true" />
                  )}
                  <span>{copied ? t('manager.passwordRequests.drawer.copiedToast') : t('manager.passwordRequests.drawer.copy')}</span>
                </button>
              </div>
            </div>
          ) : !isResolved ? (
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
                  value={tempPassword}
                  onChange={(e) => {
                    setTempPassword(e.target.value);
                    setCopied(false);
                  }}
                  className="pw-drawer__password-input"
                  placeholder="e.g. Al-Amin#7K9M"
                />
                <button
                  type="button"
                  className="pw-drawer__copy-btn"
                  onClick={() => handleCopy()}
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
          ) : null}
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
