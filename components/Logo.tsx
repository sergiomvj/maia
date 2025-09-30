import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const LOGO_LIGHT = 'https://i.imgur.com/0UBudLU.png';
const LOGO_DARK = 'https://i.imgur.com/0Zfybb6.png';

const Logo: React.FC<{ className?: string; size?: 'small' | 'large' }> = ({ className = '', size = 'large' }) => {
  const { theme } = useTheme();

  const logoSrc = theme === 'dark' ? LOGO_DARK : LOGO_LIGHT;
  const sizeClass = size === 'large' ? 'h-10' : 'h-8';

  return (
    <img
      src={logoSrc}
      alt="Maia Logo"
      className={`${sizeClass} w-auto ${className}`}
    />
  );
};

export default Logo;
