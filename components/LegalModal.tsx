import React, { Fragment } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { LegalPageType, ActiveView } from '../types';

interface LegalModalProps {
  page: LegalPageType;
  onClose: () => void;
  onNavigate?: (view: ActiveView) => void;
}

// A simple parser to handle markdown-like links `[text](url)` and bold `**text**`
const parseText = (text: string, onNavigate?: (view: ActiveView) => void) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const boldRegex = /\*\*([^*]+)\*\*/g;

    const renderSegment = (segment: string, key: number) => {
        const boldParts = segment.split(boldRegex);
        return (
            <Fragment key={key}>
                {boldParts.map((part, index) => 
                    index % 2 === 1 ? <strong key={index}>{part}</strong> : part
                )}
            </Fragment>
        );
    };

    const parts = text.split(linkRegex);
    return (
        <>
            {parts.map((part, index) => {
                if (index % 3 === 0) {
                    return renderSegment(part, index);
                }
                if (index % 3 === 1) {
                    const linkText = part;
                    const url = parts[index + 1];
                    
                    if (url.startsWith('http')) {
                        return <a href={url} target="_blank" rel="noopener noreferrer" key={index} className="text-sky-500 dark:text-sky-400 hover:underline">{linkText}</a>;
                    }
                    if (url.startsWith('#')) {
                        return <a href={url} key={index} className="text-sky-500 dark:text-sky-400 hover:underline">{linkText}</a>;
                    }
                    if (url.startsWith('app://') && onNavigate) {
                        const view = url.substring(6) as ActiveView;
                        return <button onClick={() => onNavigate(view)} key={index} className="text-sky-500 dark:text-sky-400 hover:underline font-medium">{linkText}</button>
                    }
                    // Fallback for app links when not logged in
                    return <span key={index} className="font-medium text-gray-700 dark:text-gray-300">{linkText}</span>;
                }
                return null;
            })}
        </>
    );
};


const LegalModal: React.FC<LegalModalProps> = ({ page, onClose, onNavigate }) => {
  const { t } = useLanguage();

  const content: { [key in LegalPageType]: { title: string; text: string } } = {
    about: { title: t('aboutTitle'), text: t('aboutText') },
    privacy: { title: t('privacyTitle'), text: t('privacyText') },
    terms: { title: t('termsTitle'), text: t('termsText') },
    manual: { title: t('manualTitle'), text: t('manualText') },
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
        <main className="p-6 md:p-8 overflow-y-auto">
          <div className="prose dark:prose-invert max-w-none">
            {text.split('\n').map((paragraph, index) => {
              const trimmed = paragraph.trim();
              if (trimmed === '') return null;
              
              const anchorMatch = trimmed.match(/^(### .*?){#([a-zA-Z0-9-]+)}/);
              if (anchorMatch) {
                const headerText = anchorMatch[1].replace('### ', '');
                const anchorId = anchorMatch[2];
                return <h3 key={index} id={anchorId} className="text-xl font-semibold mt-6 mb-2 scroll-mt-20">{headerText}</h3>;
              }
              
              if (trimmed.startsWith('### ')) {
                return <h3 key={index} className="text-xl font-semibold mt-6 mb-2">{trimmed.substring(4)}</h3>;
              }
              return <p key={index} className="text-gray-600 dark:text-gray-300 mb-4">{parseText(paragraph, onNavigate)}</p>;
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default LegalModal;