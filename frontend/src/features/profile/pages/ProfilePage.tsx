import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  BedDouble,
  Bell,
  Check,
  Clock,
  KeyRound,
  LogOut,
  Sparkles,
  Wallet,
  Wrench,
} from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { StatCard } from '../../../components/ui/StatCard';
import { useToast } from '../../../components/ui/ToastContext';
import { getAuthSession, clearAuthSession } from '../../../core/auth/authManager';
import { logoutRequest } from '../../auth/services/auth.api';
import { ROUTES } from '../../../core/constants/routes';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber, formatPercent } from '../../../utils/format';
import './ProfilePage.css';

export function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { language, t } = useLanguage();
  const session = getAuthSession();

  // Contact details the receptionist can edit (kept locally until the backend has a profile endpoint)
  const [contact, setContact] = useState({
    name: session?.staffName || t('topbar.userName'),
    email: session?.userId ? `reception${session.userId === '1' ? '' : session.userId}@alaminhotel.com` : 'reception@alaminhotel.com',
    phone: '+20 100 000 0000',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...contact });
  const [saving, setSaving] = useState(false);

  async function handleLogout() {
    try {
      await logoutRequest();
    } catch {
      // the local logout below must happen even if the server call fails
    }
    clearAuthSession();
    navigate(ROUTES.login, { replace: true });
  }

  function openEdit() {
    setEditForm({ ...contact });
    setIsEditing(true);
  }

  function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    window.setTimeout(() => {
      setContact({ ...editForm });
      setSaving(false);
      setIsEditing(false);
      toast.notify(t('profilePage.saved'), 'success');
    }, 400);
  }

  const n = (value: number) => formatNumber(value, language);
  const activity = [
    { id: 'payment', icon: Wallet, tone: 'green', title: t('profilePage.activity.payment'), desc: t('profilePage.activity.paymentDesc'), time: '11:42' },
    { id: 'cleaning', icon: Sparkles, tone: 'green', title: t('profilePage.activity.cleaning'), desc: t('profilePage.activity.cleaningDesc'), time: '11:18' },
    { id: 'maintenance', icon: Wrench, tone: 'gold', title: t('profilePage.activity.maintenance'), desc: t('profilePage.activity.maintenanceDesc'), time: '10:56' },
  ];
  const tasks = [
    { id: 'arrival', icon: BedDouble, label: t('profilePage.tasks.arrival'), status: t('profilePage.tasks.following'), tone: 'info' as const },
    { id: 'payment', icon: Wallet, label: t('profilePage.tasks.payment'), status: t('profilePage.tasks.done'), tone: 'success' as const },
    { id: 'maintenance', icon: Wrench, label: t('profilePage.tasks.maintenance'), status: t('profilePage.tasks.pending'), tone: 'warning' as const },
  ];
  const history = [
    { id: '18', day: 18, score: 92, shift: t('profilePage.history.morning') },
    { id: '17', day: 17, score: 88, shift: t('profilePage.history.evening') },
    { id: '15', day: 15, score: 90, shift: t('profilePage.history.night') },
  ];
  const monthName = new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-EG', { month: 'long' }).format(new Date(2026, 5, 1));
  const clock = (value: string) => (language === 'ar' ? value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]) : value);

  return (
    <div className="feature-page profile-page">
      <Card className="profile-hero">
        <span className="profile-hero__logo"><img src="/al-amin-hotel-logo.png" alt={t('profilePage.logoAlt')} /></span>
        <div className="profile-hero__copy">
          <span className="profile-hero__eyebrow">{t('profilePage.eyebrow')}</span>
          <h1>{t('profilePage.title')}</h1>
          <p>{t('profilePage.subtitle')}</p>
          <small>{t('profilePage.location')}</small>
        </div>
        <div className="profile-hero__actions">
          <Button variant="secondary" onClick={openEdit}>{t('profilePage.edit')}</Button>
          <Button onClick={() => navigate(ROUTES.settings)}>{t('profilePage.preferences')}</Button>
        </div>
      </Card>

      <section className="profile-page__stats" aria-label={t('profilePage.stats.shift')}>
        <StatCard label={t('profilePage.stats.shift')} value={t('profilePage.stats.shiftValue')} hint={t('profilePage.stats.shiftHint')} icon={<Clock />} tone="green" />
        <StatCard label={t('profilePage.stats.tasks')} value={14} hint={t('profilePage.stats.tasksHint')} icon={<Check />} tone="green" />
        <StatCard label={t('profilePage.stats.rooms')} value={18} hint={t('profilePage.stats.roomsHint')} icon={<BedDouble />} tone="gold" />
        <StatCard label={t('profilePage.stats.shifts')} value={24} hint={t('profilePage.stats.shiftsHint')} icon={<ArrowLeftRight />} tone="gold" />
      </section>

      <div className="profile-page__row">
        <Card className="profile-panel">
          <header className="profile-panel__heading">
            <div><h2>{t('profilePage.account.title')}</h2><p>{t('profilePage.account.subtitle')}</p></div>
            <span className="profile-panel__pill">{t('profilePage.account.active')}</span>
          </header>
          <div className="profile-info-grid">
            <div className="profile-info"><span>{t('profilePage.account.role')}</span><strong>{t('profilePage.account.roleValue')}</strong></div>
            <div className="profile-info"><span>{t('profilePage.account.account')}</span><strong>{t('profilePage.account.accountValue')}</strong></div>
            <div className="profile-info"><span>{t('profilePage.account.email')}</span><strong><bdi>{contact.email}</bdi></strong></div>
            <div className="profile-info"><span>{t('profilePage.account.phone')}</span><strong><bdi>{contact.phone}</bdi></strong></div>
            <div className="profile-info"><span>{t('profilePage.account.shift')}</span><strong>{t('profilePage.account.shiftValue')}</strong></div>
            <div className="profile-info"><span>{t('profilePage.account.lastLogin')}</span><strong>{t('profilePage.account.lastLoginValue')}</strong></div>
          </div>
        </Card>

        <Card className="profile-panel">
          <header className="profile-panel__heading">
            <div><h2>{t('profilePage.activity.title')}</h2><p>{t('profilePage.activity.subtitle')}</p></div>
          </header>
          <ol className="profile-activity">
            {activity.map((item) => (
              <li key={item.id}>
                <span className={`profile-activity__icon profile-activity__icon--${item.tone}`}><item.icon aria-hidden="true" /></span>
                <div><strong>{item.title}</strong><span>{item.desc}</span></div>
                <time>{clock(item.time)}</time>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="profile-page__row">
        <Card className="profile-panel">
          <header className="profile-panel__heading">
            <div><h2>{t('profilePage.tasks.title')}</h2><p>{t('profilePage.tasks.subtitle')}</p></div>
            <span className="profile-panel__pill">{t('profilePage.tasks.count').replace('{count}', n(tasks.length))}</span>
          </header>
          <ul className="profile-tasks">
            {tasks.map((task) => (
              <li key={task.id}>
                <task.icon aria-hidden="true" />
                <span>{task.label}</span>
                <Badge tone={task.tone}>{task.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="profile-panel">
          <header className="profile-panel__heading">
            <div><h2>{t('profilePage.history.title')}</h2><p>{t('profilePage.history.subtitle')}</p></div>
          </header>
          <div className="profile-history">
            {history.map((entry) => (
              <div key={entry.id}>
                <span>{n(entry.day)} {monthName}</span>
                <strong>{formatPercent(entry.score, language)}</strong>
                <small>{entry.shift}</small>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="profile-actions">
        <Button variant="secondary" onClick={() => navigate(ROUTES.settings)}><KeyRound aria-hidden="true" />{t('profilePage.actions.password')}</Button>
        <Button variant="secondary" onClick={() => navigate(ROUTES.settings)}><Bell aria-hidden="true" />{t('profilePage.actions.notifications')}</Button>
        <Button variant="secondary" onClick={() => navigate(ROUTES.login)}><ArrowLeftRight aria-hidden="true" />{t('profilePage.actions.switch')}</Button>
        <Button variant="secondary" className="profile-actions__logout" onClick={handleLogout}><LogOut aria-hidden="true" />{t('profilePage.actions.logout')}</Button>
      </Card>

      {isEditing && (
        <div className="ui-drawer-backdrop" onClick={() => setIsEditing(false)}>
          <div className="ui-dialog figma-dialog profile-edit" role="dialog" aria-modal="true" aria-label={t('editProfile')} onClick={(event) => event.stopPropagation()}>
            <h2>{t('editProfile')}</h2>
            <form onSubmit={handleSaveProfile} className="profile-edit__form">
              <label className="profile-edit__field">
                <span>{t('fullNameLabel')}</span>
                <Input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required />
              </label>
              <label className="profile-edit__field">
                <span>{t('emailLabel')}</span>
                <Input type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} required />
              </label>
              <label className="profile-edit__field">
                <span>{t('phoneLabel')}</span>
                <Input type="tel" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} required />
              </label>
              <div className="ui-dialog__actions">
                <Button variant="secondary" onClick={() => setIsEditing(false)}>{t('cancel')}</Button>
                <Button type="submit" disabled={saving}>{saving ? t('loading') : t('save')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
