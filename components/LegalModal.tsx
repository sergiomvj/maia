import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { LegalPageType } from '../types';

interface LegalModalProps {
  page: LegalPageType;
  onClose: () => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ page, onClose }) => {
  const { t } = useLanguage();

  const content: { [key in LegalPageType]: { title: string; text: string } } = {
    about: { title: t('aboutTitle'), text: t('aboutText') },
    privacy: { title: t('privacyTitle'), text: t('privacyText') },
    terms: { title: t('termsTitle'), text: t('termsText') },
  };

  const { title, text } = content[page];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h2 className="text-2xl font-bold">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </header>
        <main className="p-6 md:p-8 overflow-y-auto prose dark:prose-invert prose-p:text-gray-600 dark:prose-p:text-gray-300 max-w-none">
          {text.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </main>
      </div>
    </div>
  );
};

export default LegalModal;