import React, { useState } from 'react';
import Icon from './Icon';
import ChatInterface from './ChatInterface';
import AgendaPage from '../pages/AgendaPage';
import ShoppingListPage from '../pages/ShoppingListPage';
import ProfilePage from '../pages/ProfilePage';
import ThemeToggle from './ThemeToggle';
import { ICONS } from '../constants';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { User } from '../types';

interface DashboardLayoutProps {
  user: User;
  onLogout: () => void;
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

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ user, onLogout }) => {
  const [activeView, setActiveView] = useState<ActiveView>('chat');
  const geminiLive = useGeminiLive(user);

  const renderActiveView = () => {
    switch (activeView) {
      case 'agenda':
        return <AgendaPage events={geminiLive.calendarEvents} />;
      case 'shoppingList':
        return <ShoppingListPage geminiLive={geminiLive} />;
       case 'profile':
        return <ProfilePage user={user} />;
      case 'chat':
      default:
        return <ChatInterface geminiLive={geminiLive} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Sidebar */}
      <aside className="flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-20 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">MarIA</h1>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-2">
          <NavItem icon={ICONS.dashboard} label="Chat" isActive={activeView === 'chat'} onClick={() => setActiveView('chat')} />
          <NavItem icon={ICONS.agenda} label="Agenda" isActive={activeView === 'agenda'} onClick={() => setActiveView('agenda')} />
          <NavItem icon={ICONS.shoppingList} label="Shopping List" isActive={activeView === 'shoppingList'} onClick={() => setActiveView('shoppingList')} />
        </nav>
        <div className="px-2 py-4 border-t border-gray-200 dark:border-gray-700">
           <div className="space-y-2">
              <NavItem icon={ICONS.profile} label="Profile" isActive={activeView === 'profile'} onClick={() => setActiveView('profile')} />
              <button onClick={onLogout} className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200">
                 <Icon path={ICONS.logout} className="w-5 h-5 mr-3" />
                 <span>Logout</span>
              </button>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold capitalize">{activeView.replace('List', ' List')}</h2>
           <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${geminiLive.isConnected ? 'bg-sky-400' : 'bg-gray-400 dark:bg-gray-500'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${geminiLive.isConnected ? 'bg-sky-500' : 'bg-gray-500 dark:bg-gray-600'}`}></span>
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{geminiLive.isConnected ? 'Online' : 'Offline'}</span>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900">
           {renderActiveView()}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;