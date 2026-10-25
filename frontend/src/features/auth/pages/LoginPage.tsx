import { Eye, EyeOff, Globe } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { setAccessToken } from '../../../core/api/apiClient';
import { ROLES } from '../../../core/constants/roles';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import { getAuthSession, setAuthSession } from '../../../core/auth/authManager';
import { ROUTES } from '../../../core/constants/routes';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { validateLogin, type LoginValidationErrors } from '../schemas/login.schema';
import { login } from '../services/auth.api';

export function LoginPage() {
  const navigate = useNavigate();
  const { language, toggleLanguage, t } = useLanguage();

  useEffect(() => {
    const session = getAuthSession();
    if (session) {
      navigate(session.role === ROLES.manager ? ROUTES.managerDashboard : ROUTES.dashboard, { replace: true });
    }
  }, [navigate]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<LoginValidationErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError(null);

    const input = { username: username.trim(), password };
    const validationErrors = validateLogin(input, t);
    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const response = await login(input);
      setAccessToken(response.access_token);
      const role = String((response.staff as { role?: string }).role || '').toLowerCase();
      const isManager = role === 'manager' || role === 'admin';
      setAuthSession({
        role: isManager ? ROLES.manager : ROLES.receptionist,
        userId: String(response.staff.staff_id),
        staffName: response.staff.name,
        readOnly: response.read_only,
      });
      navigate(isManager ? ROUTES.managerDashboard : ROUTES.dashboard, { replace: true });
    } catch (error) {
      setApiError(getErrorMessage(error, language));
    } finally {
      setLoading(false);
    }
  }

  function handleForgotSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!forgotEmail) return;
    setForgotSent(true);
  }

  return (
    <div className="figma-auth-container">
      <div className="figma-auth-card">
        <div className="figma-auth-top-bar">
          <button
            type="button"
            className="figma-lang-switcher"
            onClick={toggleLanguage}
            aria-label="Switch Language"
          >
            <Globe aria-hidden="true" /> {language === 'ar' ? 'EN' : 'العربية'}
          </button>
        </div>

        <div className="figma-auth-header">
          <div className="figma-auth-logo">
            <img src="/al-amin-hotel-logo.png" alt="Al-Amin Logo" />
          </div>
          <h1 className="figma-auth-title">{t('loginTitle')}</h1>
          <p className="figma-auth-subtitle">{t('loginSubtitle')}</p>
        </div>

        {apiError && <div className="figma-alert figma-alert--error">{apiError}</div>}

        <form className="figma-auth-form" onSubmit={handleSubmit} noValidate>
          <div className="figma-form-group">
            <label htmlFor="login-username">{t('usernameLabel')}</label>
            <Input
              id="login-username"
              name="username"
              type="text"
              className="figma-input"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                if (errors.username) setErrors((previous) => ({ ...previous, username: undefined }));
              }}
              placeholder={t('usernamePlaceholder')}
              disabled={loading}
            />
            {errors.username && <span className="figma-field-error">{errors.username}</span>}
          </div>

          <div className="figma-form-group">
            <div className="figma-label-row">
              <label htmlFor="login-password">{t('passwordLabel')}</label>
              <button
                type="button"
                className="figma-link-btn"
                onClick={() => {
                  setForgotSent(false);
                  setForgotEmail('');
                  setShowForgotModal(true);
                }}
              >
                {t('forgotPassword')}
              </button>
            </div>
            <div className="figma-password-wrap">
              <Input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="figma-input"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (errors.password) setErrors((previous) => ({ ...previous, password: undefined }));
                }}
                placeholder={t('passwordPlaceholder')}
                disabled={loading}
              />
              <button
                type="button"
                className="figma-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {errors.password && <span className="figma-field-error">{errors.password}</span>}
          </div>

          <Button type="submit" disabled={loading} className="figma-btn-primary">
            {loading ? t('loading') : t('login')}
          </Button>
        </form>

        {showForgotModal && (
          <div className="ui-drawer-backdrop" onClick={() => setShowForgotModal(false)}>
            <div className="ui-dialog figma-dialog" onClick={(event) => event.stopPropagation()}>
              <h2>{t('forgotPasswordTitle')}</h2>
              {!forgotSent ? (
                <form onSubmit={handleForgotSubmit} className="figma-auth-form" style={{ marginTop: 12 }}>
                  <p className="figma-dialog-desc">{t('forgotPasswordDesc')}</p>
                  <Input
                    type="email"
                    className="figma-input"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    placeholder={t('emailPlaceholder')}
                    required
                  />
                  <div className="ui-dialog__actions">
                    <Button type="button" className="ui-button--secondary" onClick={() => setShowForgotModal(false)}>
                      {t('cancel')}
                    </Button>
                    <Button type="submit" className="figma-btn-primary" style={{ width: 'auto' }}>
                      {t('forgotPasswordSend')}
                    </Button>
                  </div>
                </form>
              ) : (
                <div>
                  <p className="figma-alert figma-alert--success">{t('forgotPasswordSuccess')}</p>
                  <div className="ui-dialog__actions">
                    <Button type="button" className="figma-btn-primary" style={{ width: 'auto' }} onClick={() => setShowForgotModal(false)}>
                      {t('back')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
