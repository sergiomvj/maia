import React, { useState } from 'react';
import Icon from './Icon';
import ChatInterface from './ChatInterface';
import AgendaPage from '../pages/AgendaPage';
import ShoppingListPage from '../pages/ShoppingListPage';
import ProfilePage from '../pages/ProfilePage';
import ThemeToggle from './ThemeToggle';
import LanguageSelector from './LanguageSelector';
import Logo from './Logo';
import Footer from './Footer';
import BottomNavBar from './BottomNavBar';
import { ICONS } from '../constants';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { User, LegalPageType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardLayoutProps {
  user: User;
  onLogout: () => void;
  onShowLegalPage: (page: LegalPageType) => void;
}

type ActiveView = 'chat' | 'agenda' | 'shoppingList' | 'profile';

const NavItem: React.FC<{
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center w-full px-4 py-3 text-sm font-medium transition-colors duration-200 rounded-md ${
      isActive
        ? 'bg-sky-500 text-white'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
    }`}
    aria-current={isActive ? 'page' : undefined}
  >
    <Icon path={icon} className="w-5 h-5 mr-3" />
    <span>{label}</span>
  </button>
);

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ user, onLogout, onShowLegalPage }) => {
  const [activeView, setActiveView] = useState<ActiveView>('chat');
  const geminiLive = useGeminiLive(user);
  const { t } = useLanguage();

  const renderActiveView = () => {
    switch (activeView) {
      case 'agenda':
        return <AgendaPage events={geminiLive.calendarEvents} />;
      case 'shoppingList':
        return <ShoppingListPage geminiLive={geminiLive} />;
       case 'profile':
        return <ProfilePage user={user} onLogout={onLogout} />;
      case 'chat':
      default:
        return <ChatInterface geminiLive={geminiLive} />;
    }
  };
  
  const viewTitles: { [key in ActiveView]: string } = {
      chat: t('navChat'),
      agenda: t('navAgenda'),
      shoppingList: t('navShoppingList'),
      profile: t('navProfile'),
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Sidebar - Hidden on mobile */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-20 border-b border-gray-200 dark:border-gray-700">
          <Logo size="small" />
        </div>
        <nav className="flex-1 px-2 py-4 space-y-2">
          <NavItem icon={ICONS.dashboard} label={t('navChat')} isActive={activeView === 'chat'} onClick={() => setActiveView('chat')} />
          <NavItem icon={ICONS.agenda} label={t('navAgenda')} isActive={activeView === 'agenda'} onClick={() => setActiveView('agenda')} />
          <NavItem icon={ICONS.shoppingList} label={t('navShoppingList')} isActive={activeView === 'shoppingList'} onClick={() => setActiveView('shoppingList')} />
        </nav>
        <div className="px-2 py-4 border-t border-gray-200 dark:border-gray-700">
           <div className="space-y-2">
              <NavItem icon={ICONS.profile} label={t('navProfile')} isActive={activeView === 'profile'} onClick={() => setActiveView('profile')} />
              <button onClick={onLogout} className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200">
                 <Icon path={ICONS.logout} className="w-5 h-5 mr-3" />
                 <span>{t('navLogout')}</span>
              </button>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold capitalize">{viewTitles[activeView]}</h2>
           <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${geminiLive.isConnected ? 'bg-sky-400' : 'bg-gray-400 dark:bg-gray-500'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${geminiLive.isConnected ? 'bg-sky-500' : 'bg-gray-500 dark:bg-gray-600'}`}></span>
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">{geminiLive.isConnected ? t('statusOnline') : t('statusOffline')}</span>
            </div>
            <LanguageSelector />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900 pb-24 md:pb-0">
           {renderActiveView()}
           <Footer onLinkClick={onShowLegalPage} />
        </div>
      </main>

      {/* Bottom Navigation - Only on mobile */}
      <BottomNavBar activeView={activeView} setActiveView={setActiveView} />
    </div>
  );
};

export default DashboardLayout;