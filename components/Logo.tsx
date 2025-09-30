import React from 'react';

const Logo: React.FC<{ className?: string; size?: 'small' | 'large' }> = ({ className = '', size = 'large' }) => (
  <h1
    className={`${size === 'large' ? 'text-4xl' : 'text-3xl'} font-extrabold text-gray-800 dark:text-gray-100 ${className}`}
    style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.1)' }}
  >
    Maia
  </h1>
);

export default Logo;