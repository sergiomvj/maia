import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { LegalPageType } from '../types';

interface FooterProps {
    onLinkClick: (page: LegalPageType) => void;
}

const Footer: React.FC<FooterProps> = ({ onLinkClick }) => {
    const { t } = useLanguage();
    return (
        <footer className="bg-white dark:bg-gray-800/50">
          <div className="container mx-auto px-6 py-8">
            <div className="flex flex-col items-center text-center">
                 <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4">
                    <button onClick={() => onLinkClick('about')} className="text-gray-600 dark:text-gray-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors">{t('footerAbout')}</button>
                    <button onClick={() => onLinkClick('privacy')} className="text-gray-600 dark:text-gray-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors">{t('footerPrivacy')}</button>
                    <button onClick={() => onLinkClick('terms')} className="text-gray-600 dark:text-gray-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors">{t('footerTerms')}</button>
                    <button onClick={() => onLinkClick('manual')} className="text-gray-600 dark:text-gray-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors">{t('footerManual')}</button>
                </div>
                <p className="text-gray-500 dark:text-gray-500 text-sm">{t('footerText')}</p>
            </div>
          </div>
        </footer>
    );
};

export default Footer;