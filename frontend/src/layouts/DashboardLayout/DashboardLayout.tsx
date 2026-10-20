import { Outlet } from 'react-router-dom';
import { useLanguage } from '../../core/i18n/useLanguage';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import './DashboardLayout.css';

// The language lives in the shared LanguageProvider (saved in the browser), so the whole app,
// including pages that read useLanguage() directly, switches together and keeps the choice after a refresh.
export function DashboardLayout() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="app-shell" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Sidebar language={language} />
      <main className="app-main">
        <Topbar language={language} onLanguageChange={setLanguage} />
        <div className="app-content">
          <Outlet context={{ language }} />
        </div>
      </main>
    </div>
  );
}
