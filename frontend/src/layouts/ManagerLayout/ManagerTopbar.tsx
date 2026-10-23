import React, { useEffect, useState, useRef } from 'react';
import { Bell, Clock, Search, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { getAuthSession } from '../../core/auth/authManager';
import { useLanguage } from '../../core/i18n/useLanguage';
import { useTheme } from '../../core/theme/useTheme';
import { formatClock } from '../../utils/format';
import { Avatar } from '../../components/ui/Avatar';
import { request } from '../../core/api/apiClient';
import './ManagerTopbar.css';

export interface ManagerTopbarProps {
  onLanguageChange?: (language: 'ar' | 'en') => void;
}

interface SearchResultItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
}

export function ManagerTopbar({ onLanguageChange }: ManagerTopbarProps): React.ReactElement {
  const [now, setNow] = useState(() => new Date());
  const { language, setLanguage, t } = useLanguage();
  const { effectiveTheme, toggleTheme } = useTheme();
  const session = getAuthSession();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const staffName =
    session?.staffName && session.staffName !== 'مدير الفندق'
      ? session.staffName
      : t('manager.shell.topbar.userName');
  const roleSubtitle = t('manager.shell.topbar.userRole');
  const avatarLetter = t('manager.shell.topbar.userAvatar');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Debounced search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const res = await request<{ data: SearchResultItem[] }>('/search', {
          params: { q: searchQuery },
        });
        setSearchResults(res.data || []);
      } catch {
        setSearchResults([]);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleToggleLanguage() {
    const nextLang = language === 'ar' ? 'en' : 'ar';
    if (onLanguageChange) {
      onLanguageChange(nextLang);
    } else {
      setLanguage(nextLang);
    }
  }

  return (
    <header className="manager-topbar">
      <div className="manager-topbar__search-wrap" ref={searchWrapRef}>
        <Search className="manager-topbar__search-icon" aria-hidden="true" />
        <input
          type="search"
          className="manager-topbar__search-input"
          placeholder={t('manager.shell.topbar.searchPlaceholder')}
          aria-label={t('manager.shell.topbar.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
        />
        <kbd className="manager-topbar__shortcut">{t('manager.shell.topbar.searchShortcut')}</kbd>

        {showDropdown && searchResults.length > 0 && (
          <ul className="manager-topbar__search-results" role="listbox">
            {searchResults.map((item) => (
              <li
                key={item.id}
                className="manager-topbar__search-item"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setShowDropdown(false);
                  setSearchQuery('');
                }}
              >
                <strong className="manager-topbar__search-item-title">{item.title}</strong>
                <span className="manager-topbar__search-item-sub">{item.subtitle}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="manager-topbar__actions">
        <div className="manager-topbar__time" aria-label={formatClock(now, language)}>
          <Clock className="manager-topbar__time-icon" aria-hidden="true" />
          <span className="manager-topbar__time-text">{formatClock(now, language)}</span>
        </div>

        <button
          type="button"
          className="manager-topbar__btn manager-topbar__theme-btn"
          onClick={toggleTheme}
          aria-label={
            effectiveTheme === 'dark'
              ? t('manager.shell.topbar.themeLight') || 'Switch to light mode'
              : t('manager.shell.topbar.themeDark') || 'Switch to dark mode'
          }
          title={
            effectiveTheme === 'dark'
              ? t('manager.shell.topbar.themeLight') || 'الوضع الفاتح'
              : t('manager.shell.topbar.themeDark') || 'الوضع الداكن'
          }
        >
          {effectiveTheme === 'dark' ? (
            <Sun className="manager-topbar__theme-icon" aria-hidden="true" />
          ) : (
            <Moon className="manager-topbar__theme-icon" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className="manager-topbar__btn manager-topbar__lang-btn"
          onClick={handleToggleLanguage}
          aria-label={t('manager.shell.topbar.languageToggle') || 'Toggle language'}
        >
          {language === 'ar' ? 'EN' : 'العربية'}
        </button>

        <button
          type="button"
          className="manager-topbar__btn manager-topbar__bell-btn"
          aria-label={t('manager.shell.topbar.notifications') || 'Notifications'}
        >
          <Bell className="manager-topbar__bell-icon" aria-hidden="true" />
          <span className="manager-topbar__bell-dot" aria-hidden="true" />
        </button>

        <div className="manager-topbar__user-chip">
          <Avatar
            letter={avatarLetter}
            size="md"
            variant="primary"
            className="manager-topbar__avatar"
          />
          <div className="manager-topbar__user-info">
            <strong className="manager-topbar__user-name">{staffName}</strong>
            <span className="manager-topbar__user-role">{roleSubtitle}</span>
          </div>
          {language === 'ar' ? (
            <ChevronLeft className="manager-topbar__chevron" aria-hidden="true" />
          ) : (
            <ChevronRight className="manager-topbar__chevron" aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  );
}
