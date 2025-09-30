import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import DashboardLayout from './components/DashboardLayout';
import LegalModal from './components/LegalModal';
import { supabase } from './supabaseClient';
import { Session, LegalPageType } from './types';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleLegalPage, setVisibleLegalPage] = useState<LegalPageType | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900" />; // Or a loading spinner
  }

  const handleShowLegalPage = (page: LegalPageType) => {
    setVisibleLegalPage(page);
  };

  return (
    <ThemeProvider>
      <LanguageProvider>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white font-sans transition-colors duration-300">
          {session && session.user ? (
            <DashboardLayout user={session.user} onLogout={() => supabase.auth.signOut()} onShowLegalPage={handleShowLegalPage} />
          ) : (
            <LandingPage onShowLegalPage={handleShowLegalPage} />
          )}
        </div>
        {visibleLegalPage && (
          <LegalModal page={visibleLegalPage} onClose={() => setVisibleLegalPage(null)} />
        )}
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
