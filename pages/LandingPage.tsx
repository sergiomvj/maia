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

const FeatureCard: React.FC<{ icon: string; title: string; description: string; }> = ({ icon, title, description }) => (
    <div className="group bg-white dark:bg-gray-800/50 p-8 rounded-2xl border border-gray-200 dark:border-gray-700/50 text-center transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:border-sky-500/50 dark:hover:border-sky-500/50">
        <div className="inline-block bg-sky-500/10 dark:bg-sky-500/20 p-5 rounded-xl mb-6 transition-colors duration-300 group-hover:bg-sky-500/20 dark:group-hover:bg-sky-500/30">
             <Icon path={icon} className="w-10 h-10 text-sky-500" />
        </div>
        <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">{description}</p>
    </div>
);


const LandingPage: React.FC<LandingPageProps> = ({ onShowLegalPage }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <div className="bg-gray-100 dark:bg-gray-900">

        {/* Hero Section */}
        <div 
            className="relative h-screen overflow-hidden"
        >
            <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url('https://i.imgur.com/CTZb457.png')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />

             <header className="absolute top-0 left-0 right-0 z-10 container mx-auto px-6 py-4 flex justify-between items-center">
              <Logo />
              <div className="flex items-center space-x-2 md:space-x-4">
                <LanguageSelector />
                <ThemeToggle />
                <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center h-10 w-10 md:w-auto md:h-auto md:py-2 md:px-4"
                    aria-label={t('loginSignUp')}
                >
                    <Icon path={ICONS.login} className="w-5 h-5 block md:hidden" />
                    <span className="hidden md:block">{t('loginSignUp')}</span>
                </button>
              </div>
            </header>

            <main className="relative z-0 h-full flex flex-col items-center justify-center text-center text-white px-6">
                <div className="max-w-4xl">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-4 leading-tight tracking-tight" style={{textShadow: '0 2px 10px rgba(0,0,0,0.5)'}}>
                        {t('heroTitleLine1')}
                        <br />
                        <span className="text-sky-400">{t('heroTitleLine2')}</span>
                    </h1>
                    <p className="text-base sm:text-lg md:text-xl text-gray-200 max-w-2xl mx-auto mb-8" style={{textShadow: '0 1px 5px rgba(0,0,0,0.5)'}}>
                        {t('heroSubtitle')}
                    </p>
                    <button onClick={() => setIsAuthModalOpen(true)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 px-10 rounded-lg text-lg transition-transform transform hover:scale-105 shadow-2xl">
                        {t('getStarted')}
                    </button>
                </div>
            </main>
        </div>

        {/* Features Section */}
        <section className="bg-white dark:bg-gray-800 py-20 md:py-28">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <h2 className="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">{t('featuresGridTitle')}</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {t('featuresGridSubtitle')}
              </p>
            </div>
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <FeatureCard icon={ICONS.reminders} title={t('featureTaskTitle')} description={t('featureRemindersCardDesc')} />
                <FeatureCard icon={ICONS.notes} title={t('featureNotesTitle')} description={t('featureNotesCardDesc')} />
                <FeatureCard icon={ICONS.shoppingList} title={t('featureCartTitle')} description={t('featureShoppingCardDesc')} />
                <FeatureCard icon={ICONS.agenda} title={t('featureCalendarTitle')} description={t('featureAgendaCardDesc')} />
            </div>
          </div>
        </section>

        <Footer onLinkClick={onShowLegalPage} />
      </div>
    </>
  );
};

export default LandingPage;
