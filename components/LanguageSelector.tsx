import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Language, languageNames } from '../translations';

const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  return (
    <div className="relative">
      <select
        value={language}
        onChange={handleLanguageChange}
        className="appearance-none bg-gray-200 dark:bg-gray-700 border-none text-gray-700 dark:text-gray-300 py-2 pl-3 pr-8 rounded-md leading-tight focus:outline-none focus:bg-gray-300 dark:focus:bg-gray-600 focus:ring-2 focus:ring-sky-500 text-sm"
        aria-label="Select language"
      >
        {(Object.keys(languageNames) as Language[]).map(lang => (
          <option key={lang} value={lang}>
            {languageNames[lang]}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>
    </div>
  );
};

export default LanguageSelector;
