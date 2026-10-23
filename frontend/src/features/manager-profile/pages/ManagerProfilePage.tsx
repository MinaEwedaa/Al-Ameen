import React, { useState, useEffect, useCallback } from 'react';
import type {
  ManagerProfile,
  ManagerKPIs,
  ManagerActivityItem,
} from '../types/manager-profile.types';
import {
  getManagerProfile,
  getManagerKPIs,
  getManagerActivities,
} from '../services/manager-profile.api';
import { ProfileHeaderCard } from '../components/ProfileHeaderCard';
import { ProfileStatsGrid } from '../components/ProfileStatsGrid';
import { AccountInfoCard } from '../components/AccountInfoCard';
import { RecentActivityTimeline } from '../components/RecentActivityTimeline';
import { ProfileBottomBar } from '../components/ProfileBottomBar';
import { EditProfileDrawer } from '../components/EditProfileDrawer';
import { ChangePasswordDrawer } from '../components/ChangePasswordDrawer';
import { Spinner } from '../../../components/ui/Spinner';
import { useLanguage } from '../../../core/i18n/useLanguage';
import './ManagerProfilePage.css';

export function ManagerProfilePage(): React.ReactElement {
  const { t } = useLanguage();

  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [kpis, setKpis] = useState<ManagerKPIs | null>(null);
  const [activities, setActivities] = useState<ManagerActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [passwordDrawerOpen, setPasswordDrawerOpen] = useState(false);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);
    try {
      const [profileRes, kpisRes, activitiesRes] = await Promise.all([
        getManagerProfile(),
        getManagerKPIs(),
        getManagerActivities(),
      ]);
      setProfile(profileRes);
      setKpis(kpisRes);
      setActivities(activitiesRes);
    } catch {
      setError('Failed to load profile data');
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  if (loading) {
    return (
      <div className="manager-profile-page manager-profile-page--loading">
        <Spinner />
      </div>
    );
  }

  if (error || !profile || !kpis) {
    return (
      <div className="manager-profile-page manager-profile-page--error">
        <p className="manager-profile-page__error-msg">{error || 'Unable to load profile'}</p>
        <button
          type="button"
          className="manager-profile-page__retry-btn"
          onClick={() => loadData(true)}
        >
          {t('manager.profile.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="manager-profile-page">
      <ProfileHeaderCard
        profile={profile}
        onEditClick={() => setEditDrawerOpen(true)}
      />

      <ProfileStatsGrid kpis={kpis} />

      <div className="manager-profile-page__grid">
        <AccountInfoCard profile={profile} />
        <RecentActivityTimeline activities={activities} />
      </div>

      <ProfileBottomBar
        onChangePasswordClick={() => setPasswordDrawerOpen(true)}
      />

      <EditProfileDrawer
        open={editDrawerOpen}
        profile={profile}
        onClose={() => setEditDrawerOpen(false)}
        onSuccess={(updated) => {
          setProfile({ ...updated });
          void loadData(false);
        }}
      />

      <ChangePasswordDrawer
        open={passwordDrawerOpen}
        onClose={() => setPasswordDrawerOpen(false)}
      />
    </div>
  );
}
