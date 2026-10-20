import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Bell,
  Check,
  FileText,
  Globe,
  KeyRound,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  User,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';
import { PageHero } from '../../../components/common/PageHero';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/ToastContext';
import { getAuthSession } from '../../../core/auth/authManager';
import { ROUTES } from '../../../core/constants/routes';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { useTheme } from '../../../core/theme/useTheme';
import './SettingsPage.css';

type SectionId = 'account' | 'notifications' | 'appearance' | 'security';
type NotificationKey = 'rooms' | 'housekeeping' | 'maintenance' | 'payments' | 'pending' | 'handover';

const NOTIFICATION_KEYS: NotificationKey[] = ['rooms', 'housekeeping', 'maintenance', 'payments', 'pending', 'handover'];

export function SettingsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { language, setLanguage, t } = useLanguage();
  const { themeMode, setThemeMode } = useTheme();
  const session = getAuthSession();

  const [activeNav, setActiveNav] = useState('account');
  const [account, setAccount] = useState({
    name: session?.staffName || t('topbar.userName'),
    email: 'reception@alaminhotel.com',
    phone: '+20 100 000 0000',
  });
  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    rooms: true,
    housekeeping: true,
    maintenance: true,
    payments: true,
    pending: true,
    handover: true,
  });

  // Each nav item scrolls to its card; the profile and switch-account items go to their pages
  const navItems: Array<{ id: string; label: string; icon: LucideIcon; target?: SectionId; onSelect?: () => void }> = [
    { id: 'account', label: t('settingsPage.nav.account'), icon: User, target: 'account' },
    { id: 'profile', label: t('settingsPage.nav.profile'), icon: UserCircle, onSelect: () => navigate(ROUTES.profile) },
    { id: 'language', label: t('settingsPage.nav.language'), icon: Globe, target: 'appearance' },
    { id: 'notifications', label: t('settingsPage.nav.notifications'), icon: Bell, target: 'notifications' },
    { id: 'appearance', label: t('settingsPage.nav.appearance'), icon: Palette, target: 'appearance' },
    { id: 'preferences', label: t('settingsPage.nav.preferences'), icon: SlidersHorizontal, target: 'notifications' },
    { id: 'security', label: t('settingsPage.nav.security'), icon: ShieldCheck, target: 'security' },
    { id: 'switch', label: t('settingsPage.nav.switch'), icon: ArrowLeftRight, onSelect: () => navigate(ROUTES.login) },
  ];

  function selectNav(item: (typeof navItems)[number]) {
    setActiveNav(item.id);
    if (item.onSelect) {
      item.onSelect();
      return;
    }
    if (item.target) document.getElementById(`settings-${item.target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleSave() {
    toast.notify(t('settingsPage.saved'), 'success');
  }

  function handleExport() {
    const content = JSON.stringify({ account, notifications, language, theme: themeMode }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'al-amin-preferences.json';
    link.click();
    URL.revokeObjectURL(url);
    toast.notify(t('settingsPage.exported'), 'success');
  }

  const pill = (active: boolean) => `settings-pills__option${active ? ' settings-pills__option--active' : ''}`;

  return (
    <div className="feature-page settings-page">
      <PageHero eyebrow={t('settingsPage.eyebrow')} title={t('settingsPage.title')} description={t('settingsPage.description')}>
        <Button variant="glass" onClick={handleExport}><FileText aria-hidden="true" />{t('settingsPage.export')}</Button>
        <Button variant="gold" onClick={handleSave}><Check aria-hidden="true" />{t('settingsPage.save')}</Button>
      </PageHero>

      <div className="settings-page__permission" role="note">
        <Check aria-hidden="true" />
        <div>
          <strong>{t('settingsPage.permission.title')}</strong>
          <span>{t('settingsPage.permission.message')}</span>
        </div>
      </div>

      <div className="settings-page__layout">
        <Card className="settings-nav">
          <nav aria-label={t('settingsPage.nav.label')}>
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings-nav__item${activeNav === item.id ? ' settings-nav__item--active' : ''}`}
                aria-current={activeNav === item.id ? 'true' : undefined}
                onClick={() => selectNav(item)}
              >
                <item.icon aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </Card>

        <div className="settings-page__content">
          <Card className="settings-section" id="settings-account">
            <header className="settings-section__heading">
              <div><h2>{t('settingsPage.account.title')}</h2><p>{t('settingsPage.account.subtitle')}</p></div>
              <span className="settings-section__pill">{t('settingsPage.account.badge')}</span>
            </header>
            <div className="settings-fields">
              <label className="settings-field">
                <span>{t('settingsPage.account.name')}</span>
                <Input value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} />
              </label>
              <label className="settings-field">
                <span>{t('settingsPage.account.email')}</span>
                <Input type="email" value={account.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} />
              </label>
              <label className="settings-field">
                <span>{t('settingsPage.account.phone')}</span>
                <Input type="tel" dir="ltr" value={account.phone} onChange={(event) => setAccount({ ...account, phone: event.target.value })} />
              </label>
              <label className="settings-field">
                <span>{t('settingsPage.account.role')}</span>
                <Input value={t('settingsPage.account.roleValue')} readOnly aria-readonly="true" />
              </label>
            </div>
          </Card>

          <Card className="settings-section" id="settings-notifications">
            <header className="settings-section__heading">
              <div><h2>{t('settingsPage.notifications.title')}</h2><p>{t('settingsPage.notifications.subtitle')}</p></div>
            </header>
            <div className="settings-toggles">
              {NOTIFICATION_KEYS.map((key) => (
                <label key={key} className="settings-toggle">
                  <span className="settings-toggle__copy">
                    <strong>{t(`settingsPage.notifications.${key}`)}</strong>
                    <span>{t('settingsPage.notifications.hint')}</span>
                  </span>
                  <span className="settings-switch">
                    <input
                      type="checkbox"
                      checked={notifications[key]}
                      onChange={() => setNotifications((current) => ({ ...current, [key]: !current[key] }))}
                    />
                    <span aria-hidden="true" />
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Card className="settings-section settings-section--bar" id="settings-appearance">
            <div className="settings-bar-group">
              <span>{t('settingsPage.appearance.title')}</span>
              <div className="settings-pills" role="group" aria-label={t('settingsPage.appearance.title')}>
                <button type="button" className={pill(themeMode === 'light')} aria-pressed={themeMode === 'light'} onClick={() => setThemeMode('light')}>{t('settingsPage.appearance.light')}</button>
                <button type="button" className={pill(themeMode === 'dark')} aria-pressed={themeMode === 'dark'} onClick={() => setThemeMode('dark')}>{t('settingsPage.appearance.dark')}</button>
                <button type="button" className={pill(themeMode === 'system')} aria-pressed={themeMode === 'system'} onClick={() => setThemeMode('system')}>{t('settingsPage.appearance.system')}</button>
              </div>
            </div>
            <div className="settings-bar-group">
              <span>{t('settingsPage.appearance.language')}</span>
              <div className="settings-pills" role="group" aria-label={t('settingsPage.appearance.language')}>
                <button type="button" className={pill(language === 'ar')} aria-pressed={language === 'ar'} onClick={() => setLanguage('ar')}>العربية</button>
                <button type="button" className={pill(language === 'en')} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
              </div>
            </div>
          </Card>

          <Card className="settings-section settings-section--security" id="settings-security">
            <span className="settings-section__icon"><KeyRound aria-hidden="true" /></span>
            <div className="settings-section__security-copy">
              <strong>{t('settingsPage.security.title')}</strong>
              <span>{t('settingsPage.security.subtitle')}</span>
            </div>
            <Button variant="secondary" onClick={() => toast.notify(t('settingsPage.security.soon'), 'warning')}>{t('settingsPage.security.change')}</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
