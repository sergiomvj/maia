import React from 'react';
import Icon from './Icon';
import { ICONS } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

type ActiveView = 'chat' | 'agenda' | 'shoppingList' | 'profile';

interface BottomNavBarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

const BottomNavItem: React.FC<{
    icon: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-full pt-2 pb-1 transition-colors duration-200 ${
      isActive ? 'text-sky-500' : 'text-gray-500 dark:text-gray-400 hover:text-sky-500 dark:hover:text-sky-400'
    }`}
    aria-current={isActive ? 'page' : undefined}
  >
    <Icon path={icon} className="w-6 h-6 mb-1" />
    <span className="text-xs font-medium">{label}</span>
  </button>
);

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeView, setActiveView }) => {
    const { t } = useLanguage();
    return (
        <nav className="fixed bottom-0 left-0 right-0 md:hidden flex items-center justify-around bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 h-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-40">
            <BottomNavItem icon={ICONS.dashboard} label={t('navChat')} isActive={activeView === 'chat'} onClick={() => setActiveView('chat')} />
            <BottomNavItem icon={ICONS.agenda} label={t('navAgenda')} isActive={activeView === 'agenda'} onClick={() => setActiveView('agenda')} />
            <BottomNavItem icon={ICONS.shoppingList} label={t('navShoppingList')} isActive={activeView === 'shoppingList'} onClick={() => setActiveView('shoppingList')} />
            <BottomNavItem icon={ICONS.profile} label={t('navProfile')} isActive={activeView === 'profile'} onClick={() => setActiveView('profile')} />
        </nav>
    );
};

export default BottomNavBar;
