import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  ManagerSettings,
  SettingsTabId,
  HotelInfoSettings,
  ShiftTiming,
  NotificationSettings,
  AppearanceMode,
} from '../types/manager-settings.types';
import {
  getManagerSettings,
  updateManagerSettings,
} from '../services/manager-settings.api';
import { exportSettingsAsJson } from '../utils/settingsExport';
import { SettingsHero } from '../components/SettingsHero';
import { SettingsSideNav } from '../components/SettingsSideNav';
import { HotelInfoSection } from '../components/HotelInfoSection';
import { ShiftsConfigSection } from '../components/ShiftsConfigSection';
import { NotificationsSection } from '../components/NotificationsSection';
import { PreferencesSection } from '../components/PreferencesSection';
import { Spinner } from '../../../components/ui/Spinner';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { useToast } from '../../../components/ui/ToastContext';
import './ManagerSettingsPage.css';

const VALID_TABS: SettingsTabId[] = ['hotel', 'shifts', 'notifications', 'language', 'appearance'];

export function ManagerSettingsPage(): React.ReactElement {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as SettingsTabId | null;
  const activeTab: SettingsTabId =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'hotel';

  const [initialSettings, setInitialSettings] = useState<ManagerSettings | null>(null);
  const [settings, setSettings] = useState<ManagerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getManagerSettings();
      setInitialSettings(data);
      setSettings(data);
    } catch {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Dirty state tracking
  const hasChanges = useMemo(() => {
    if (!settings || !initialSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  // Unsaved changes guard (warn before leaving page)
  useEffect(() => {
    if (!hasChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t('manager.settings.unsavedWarning');
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges, t]);

  // Smooth scroll when tab changes
  useEffect(() => {
    if (!loading && tabParam) {
      const targetElement = document.getElementById(`settings-${tabParam}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [tabParam, loading]);

  function handleSelectTab(tab: SettingsTabId) {
    setSearchParams({ tab });
    const targetElement = document.getElementById(`settings-${tab}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleHotelInfoChange(updated: Partial<HotelInfoSettings>) {
    setSettings((prev) => (prev ? { ...prev, hotelInfo: { ...prev.hotelInfo, ...updated } } : null));
  }

  function handleShiftsChange(updatedShifts: ShiftTiming[]) {
    setSettings((prev) => (prev ? { ...prev, shifts: updatedShifts } : null));
  }

  function handleNotificationsChange(updated: Partial<NotificationSettings>) {
    setSettings((prev) =>
      prev ? { ...prev, notifications: { ...prev.notifications, ...updated } } : null,
    );
  }

  function handleAppearanceChange(mode: AppearanceMode) {
    setSettings((prev) => (prev ? { ...prev, appearance: mode } : null));
  }

  async function handleSave() {
    if (!settings || saving || !hasChanges) return;
    setSaving(true);
    try {
      const saved = await updateManagerSettings(settings);
      setInitialSettings(saved);
      setSettings(saved);
      showToast(t('manager.settings.hero.savedToast'), 'success');
    } catch {
      showToast(t('manager.settings.hero.saveErrorToast'), 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    if (!settings) return;
    try {
      exportSettingsAsJson(settings);
      showToast(t('manager.settings.hero.exportedToast'), 'success');
    } catch {
      showToast(t('manager.passwordRequests.exportSuccess'), 'info');
    }
  }

  if (loading) {
    return (
      <div className="manager-settings-page manager-settings-page--loading">
        <Spinner />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="manager-settings-page manager-settings-page--error">
        <p className="manager-settings-page__error-msg">{error || 'Unable to load settings'}</p>
        <button
          type="button"
          className="manager-settings-page__retry-btn"
          onClick={loadSettings}
        >
          {t('manager.settings.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="manager-settings-page">
      <SettingsHero
        hasChanges={hasChanges}
        saving={saving}
        onSave={handleSave}
        onExport={handleExport}
      />

      <div className="manager-settings-page__layout">
        <div className="manager-settings-page__sidebar">
          <SettingsSideNav
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
          />
        </div>

        <main className="manager-settings-page__content">
          <HotelInfoSection
            hotelInfo={settings.hotelInfo}
            onChange={handleHotelInfoChange}
            showAutoSavedBadge={true}
          />

          <ShiftsConfigSection
            shifts={settings.shifts}
            onChange={handleShiftsChange}
          />

          <NotificationsSection
            notifications={settings.notifications}
            onChange={handleNotificationsChange}
          />

          <PreferencesSection
            appearance={settings.appearance}
            onAppearanceChange={handleAppearanceChange}
          />
        </main>
      </div>
    </div>
  );
}
