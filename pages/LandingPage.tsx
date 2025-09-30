import React, { useState } from 'react';
import Icon from '../components/Icon';
import AuthModal from '../components/AuthModal';
import LanguageSelector from '../components/LanguageSelector';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import Footer from '../components/Footer';
import { ICONS } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { LegalPageType } from '../types';

interface LandingPageProps {
    onShowLegalPage: (page: LegalPageType) => void;
}

const ModernFeature: React.FC<{ icon: string; title: string; children: React.ReactNode; reverse?: boolean }> = ({ icon, title, children, reverse = false }) => (
    <div className={`flex flex-col md:flex-row items-center gap-8 md:gap-12 ${reverse ? 'md:flex-row-reverse' : ''}`}>
        <div className="flex-shrink-0 bg-sky-500/10 dark:bg-sky-500/20 p-6 rounded-2xl w-32 h-32 flex items-center justify-center">
             <Icon path={icon} className="w-16 h-16 text-sky-500" />
        </div>
        <div className="text-center md:text-left flex-1">
            <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{title}</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{children}</p>
        </div>
    </div>
);


const LandingPage: React.FC<LandingPageProps> = ({ onShowLegalPage }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        {/* Header */}
        <header className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Logo />
          <div className="flex items-center space-x-4">
            <LanguageSelector />
            <ThemeToggle />
            <button onClick={() => setIsAuthModalOpen(true)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
              {t('loginSignUp')}
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="relative h-[550px] flex flex-col justify-end text-center text-white overflow-hidden">
            {/* Background Video and Overlay */}
            <div className="absolute inset-0">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute z-0 w-full h-full object-cover"
                src="https://videos.pexels.com/video-files/4784458/4784458-hd.mp4"
              >
                Your browser does not support the video tag.
              </video>
              <div className="absolute inset-0 bg-teal-800/75" />
            </div>

            {/* Content */}
            <div className="relative z-10 px-6 pb-[100px]">
                <h2 className="text-5xl font-extrabold mb-4" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.4)' }}>
                    {t('heroTitleLine1')}
                    <br />
                    {t('heroTitleLine2')}
                </h2>
                <p className="text-lg text-gray-200 max-w-2xl mx-auto mb-8" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.4)' }}>
                    {t('heroSubtitle')}
                </p>
                <button onClick={() => setIsAuthModalOpen(true)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-transform transform hover:scale-105 shadow-lg">
                    {t('getStarted')}
                </button>
            </div>
        </main>

        {/* "What Maia can do for you" Section */}
        <section className="bg-white dark:bg-gray-800/50 py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-extrabold mb-4">{t('modernFeaturesTitle')}</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                {t('modernFeaturesSubtitle')}
              </p>
            </div>
            <div className="max-w-4xl mx-auto space-y-16">
                <ModernFeature icon={ICONS.reminders} title={t('featureTameTitle')}>
                    {t('featureTameDesc')}
                </ModernFeature>
                <ModernFeature icon={ICONS.notes} title={t('featureBrainTitle')} reverse>
                    {t('featureBrainDesc')}
                </ModernFeature>
                <ModernFeature icon={ICONS.shoppingList} title={t('featureCartTitle')}>
                    {t('featureCartDesc')}
                </ModernFeature>
                 <ModernFeature icon={ICONS.agenda} title={t('featureAgendaTitle')} reverse>
                    {t('featureAgendaDesc')}
                </ModernFeature>
            </div>
          </div>
        </section>

        {/* Footer */}
        <Footer onLinkClick={onShowLegalPage} />
      </div>
    </>
  );
};

export default LandingPage;