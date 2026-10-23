import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import type { ManagerProfile } from '../types/manager-profile.types';
import { Drawer } from '../../../components/ui/Drawer';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { useToast } from '../../../components/ui/ToastContext';
import { updateManagerProfile } from '../services/manager-profile.api';
import './EditProfileDrawer.css';

interface EditProfileDrawerProps {
  open: boolean;
  profile: ManagerProfile;
  onClose: () => void;
  onSuccess: (updated: ManagerProfile) => void;
}

export function EditProfileDrawer({
  open,
  profile,
  onClose,
  onSuccess,
}: EditProfileDrawerProps): React.ReactElement | null {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});

  useEffect(() => {
    if (open) {
      setName(profile.name);
      setEmail(profile.email);
      setPhone(profile.phone);
      setErrors({});
    }
  }, [open, profile]);

  function validate() {
    const newErrors: { name?: string; email?: string; phone?: string } = {};

    if (!name.trim()) {
      newErrors.name = t('manager.profile.editDrawer.errors.nameRequired');
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('manager.profile.editDrawer.errors.emailInvalid');
    }

    if (!phone.trim()) {
      newErrors.phone = t('manager.profile.editDrawer.errors.phoneInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      const updated = await updateManagerProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      showToast(t('manager.profile.toasts.updateSuccess'), 'success');
      onSuccess(updated);
      onClose();
    } catch {
      showToast(t('manager.profile.toasts.updateError'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow={t('manager.profile.editDrawer.eyebrow')}
      title={t('manager.profile.editDrawer.title')}
      className="edit-profile-drawer"
      footer={
        <div className="edit-profile-drawer__actions">
          <button
            type="submit"
            form="edit-profile-form"
            className="edit-profile-drawer__btn edit-profile-drawer__btn--save"
            disabled={submitting}
          >
            {submitting ? t('loading') : t('manager.profile.editDrawer.save')}
          </button>
          <button
            type="button"
            className="edit-profile-drawer__btn edit-profile-drawer__btn--cancel"
            onClick={onClose}
            disabled={submitting}
          >
            {t('manager.profile.editDrawer.cancel')}
          </button>
        </div>
      }
    >
      <form id="edit-profile-form" onSubmit={handleSubmit} className="edit-profile-form" noValidate>
        <div className="edit-profile-form__field">
          <label htmlFor="manager-name" className="edit-profile-form__label">
            {t('manager.profile.editDrawer.name')}
          </label>
          <input
            id="manager-name"
            type="text"
            className={`edit-profile-form__input ${errors.name ? 'edit-profile-form__input--error' : ''}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            required
          />
          {errors.name && <span className="edit-profile-form__error">{errors.name}</span>}
        </div>

        <div className="edit-profile-form__field">
          <label htmlFor="manager-email" className="edit-profile-form__label">
            {t('manager.profile.editDrawer.email')}
          </label>
          <input
            id="manager-email"
            type="email"
            dir="ltr"
            className={`edit-profile-form__input ${errors.email ? 'edit-profile-form__input--error' : ''}`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            required
          />
          {errors.email && <span className="edit-profile-form__error">{errors.email}</span>}
        </div>

        <div className="edit-profile-form__field">
          <label htmlFor="manager-phone" className="edit-profile-form__label">
            {t('manager.profile.editDrawer.phone')}
          </label>
          <input
            id="manager-phone"
            type="tel"
            dir="ltr"
            className={`edit-profile-form__input ${errors.phone ? 'edit-profile-form__input--error' : ''}`}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            required
          />
          {errors.phone && <span className="edit-profile-form__error">{errors.phone}</span>}
        </div>
      </form>
    </Drawer>
  );
}
