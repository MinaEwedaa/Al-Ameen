import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Drawer } from '../../../components/ui/Drawer';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { useToast } from '../../../components/ui/ToastContext';
import { ApiError } from '../../../core/api/apiError';
import { changeManagerPassword } from '../services/manager-profile.api';
import './ChangePasswordDrawer.css';

interface ChangePasswordDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordDrawer({
  open,
  onClose,
}: ChangePasswordDrawerProps): React.ReactElement | null {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    if (open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setErrors({});
    }
  }, [open]);

  function validate() {
    const newErrors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword.trim()) {
      newErrors.currentPassword = t('manager.profile.passwordDrawer.errors.currentRequired');
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;
    if (!newPassword.trim()) {
      newErrors.newPassword = t('manager.profile.passwordDrawer.errors.newRequired');
    } else if (newPassword.trim().length < 12) {
      newErrors.newPassword = 'Password must be at least 12 characters long.';
    } else if (!strongPasswordRegex.test(newPassword.trim())) {
      newErrors.newPassword = 'Password must contain at least one uppercase letter, one lowercase letter, and one number.';
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = t('manager.profile.passwordDrawer.errors.mismatch');
    } else if (newPassword.trim() !== confirmPassword.trim()) {
      newErrors.confirmPassword = t('manager.profile.passwordDrawer.errors.mismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      await changeManagerPassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
        confirmPassword: confirmPassword.trim(),
      });
      showToast(t('manager.profile.toasts.passwordSuccess'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('current') || msg.includes('الحالية')) {
          setErrors((prev) => ({
            ...prev,
            currentPassword: t('manager.profile.passwordDrawer.errors.currentRequired'),
          }));
        } else if (msg.includes('match') || msg.includes('تطابق')) {
          setErrors((prev) => ({
            ...prev,
            confirmPassword: t('manager.profile.passwordDrawer.errors.mismatch'),
          }));
        } else if (msg.includes('8') || msg.includes('character') || msg.includes('length')) {
          setErrors((prev) => ({
            ...prev,
            newPassword: t('manager.profile.passwordDrawer.errors.minLength'),
          }));
        }
      }
      showToast(t('manager.profile.toasts.passwordError'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const toggleAriaLabel =
    t('manager.profile.passwordDrawer.toggleVisibility') || 'Toggle password visibility';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow={t('manager.profile.passwordDrawer.eyebrow')}
      title={t('manager.profile.passwordDrawer.title')}
      className="password-drawer"
      footer={
        <div className="password-drawer__actions">
          <button
            type="submit"
            form="change-password-form"
            className="password-drawer__btn password-drawer__btn--save"
            disabled={submitting}
          >
            {submitting ? t('loading') : t('manager.profile.passwordDrawer.save')}
          </button>
          <button
            type="button"
            className="password-drawer__btn password-drawer__btn--cancel"
            onClick={onClose}
            disabled={submitting}
          >
            {t('manager.profile.passwordDrawer.cancel')}
          </button>
        </div>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit} className="password-form" noValidate>
        <div className="password-form__field">
          <label htmlFor="current-pw" className="password-form__label">
            {t('manager.profile.passwordDrawer.currentPassword')}
          </label>
          <div className="password-form__input-wrap">
            <input
              id="current-pw"
              type={showCurrent ? 'text' : 'password'}
              dir="ltr"
              className={`password-form__input ${
                errors.currentPassword ? 'password-form__input--error' : ''
              }`}
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (errors.currentPassword) {
                  setErrors((prev) => ({ ...prev, currentPassword: undefined }));
                }
              }}
              required
            />
            <button
              type="button"
              className="password-form__toggle-btn"
              onClick={() => setShowCurrent((prev) => !prev)}
              aria-label={toggleAriaLabel}
            >
              {showCurrent ? <EyeOff className="password-form__eye" /> : <Eye className="password-form__eye" />}
            </button>
          </div>
          {errors.currentPassword && (
            <span className="password-form__error">{errors.currentPassword}</span>
          )}
        </div>

        <div className="password-form__field">
          <label htmlFor="new-pw" className="password-form__label">
            {t('manager.profile.passwordDrawer.newPassword')}
          </label>
          <div className="password-form__input-wrap">
            <input
              id="new-pw"
              type={showNew ? 'text' : 'password'}
              dir="ltr"
              className={`password-form__input ${
                errors.newPassword ? 'password-form__input--error' : ''
              }`}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errors.newPassword) {
                  setErrors((prev) => ({ ...prev, newPassword: undefined }));
                }
              }}
              required
            />
            <button
              type="button"
              className="password-form__toggle-btn"
              onClick={() => setShowNew((prev) => !prev)}
              aria-label={toggleAriaLabel}
            >
              {showNew ? <EyeOff className="password-form__eye" /> : <Eye className="password-form__eye" />}
            </button>
          </div>
          {errors.newPassword ? (
            <span className="password-form__error">{errors.newPassword}</span>
          ) : (
            <span className="password-form__hint">{t('manager.profile.passwordDrawer.hint')}</span>
          )}
        </div>

        <div className="password-form__field">
          <label htmlFor="confirm-pw" className="password-form__label">
            {t('manager.profile.passwordDrawer.confirmPassword')}
          </label>
          <div className="password-form__input-wrap">
            <input
              id="confirm-pw"
              type={showConfirm ? 'text' : 'password'}
              dir="ltr"
              className={`password-form__input ${
                errors.confirmPassword ? 'password-form__input--error' : ''
              }`}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) {
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              }}
              required
            />
            <button
              type="button"
              className="password-form__toggle-btn"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={toggleAriaLabel}
            >
              {showConfirm ? <EyeOff className="password-form__eye" /> : <Eye className="password-form__eye" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <span className="password-form__error">{errors.confirmPassword}</span>
          )}
        </div>
      </form>
    </Drawer>
  );
}
