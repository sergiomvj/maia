import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Icon from './Icon';
import { ICONS } from '../constants';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      aria-label="Toggle theme"
    >
      <Icon path={theme === 'dark' ? ICONS.sun : ICONS.moon} className="w-5 h-5" />
    </button>
  );
};

export default ThemeToggle;
