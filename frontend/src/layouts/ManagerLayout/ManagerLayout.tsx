import React from 'react';
import { Outlet } from 'react-router-dom';
import { useLanguage } from '../../core/i18n/useLanguage';
import { ManagerSidebar } from './ManagerSidebar';
import { ManagerTopbar } from './ManagerTopbar';
import './ManagerLayout.css';
import './ManagerTheme.css';

export function ManagerLayout(): React.ReactElement {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="manager-shell" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <ManagerSidebar />
      <main className="manager-main">
        <ManagerTopbar onLanguageChange={setLanguage} />
        <div className="manager-content">
          <Outlet context={{ language }} />
        </div>
      </main>
    </div>
  );
}
