import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PasswordRequest } from '../types/password-request.types';
import { getPasswordRequests } from '../services/password-requests.api';
import { exportPasswordRequestsCsv } from '../utils/passwordRequestsExport';
import { PasswordRequestsHero } from '../components/PasswordRequestsHero';
import { PasswordRequestsList } from '../components/PasswordRequestsList';
import { PasswordRequestDrawer } from '../components/PasswordRequestDrawer';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { useToast } from '../../../components/ui/ToastContext';
import { Spinner } from '../../../components/ui/Spinner';

export function ManagerPasswordRequestsPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');
  const { language, t } = useLanguage();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<PasswordRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPasswordRequests()
      .then((data) => {
        if (active) {
          setRequests(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests],
  );

  const displayedRequests = useMemo(() => {
    if (pendingOnly) {
      return requests.filter((r) => r.status === 'pending');
    }
    return requests;
  }, [requests, pendingOnly]);

  const selectedRequest = useMemo(
    () => (selectedId ? requests.find((r) => r.id === selectedId) || null : null),
    [requests, selectedId],
  );

  function handleSelect(id: string) {
    setSearchParams({ id });
  }

  function handleCloseDrawer() {
    searchParams.delete('id');
    setSearchParams(searchParams);
  }

  function handleUpdated(updated: PasswordRequest) {
    setRequests((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  function handleExport() {
    const success = exportPasswordRequestsCsv(displayedRequests, language);
    if (success) {
      showToast(t('manager.passwordRequests.exportSuccess'), 'success');
    }
  }

  return (
    <div className="manager-password-requests-page">
      <PasswordRequestsHero
        onExport={handleExport}
        pendingOnly={pendingOnly}
        onTogglePendingOnly={() => setPendingOnly((prev) => !prev)}
        pendingCount={pendingCount}
      />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spinner />
        </div>
      ) : (
        <PasswordRequestsList
          requests={displayedRequests}
          onSelect={handleSelect}
          selectedId={selectedId}
        />
      )}

      <PasswordRequestDrawer
        request={selectedRequest}
        open={Boolean(selectedRequest)}
        onClose={handleCloseDrawer}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
