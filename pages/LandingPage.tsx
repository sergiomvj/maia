import React, { useState } from 'react';
import Icon from '../components/Icon';
import AuthModal from '../components/AuthModal';
import { ICONS } from '../constants';

const FeatureCard: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 transform hover:scale-105 transition-transform duration-300 shadow-md">
    <div className="flex items-center justify-center w-12 h-12 bg-sky-500 rounded-full mb-4">
      <Icon path={icon} className="w-6 h-6 text-white" />
    </div>
    <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400">{children}</p>
  </div>
);

const LandingPage: React.FC = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        {/* Header */}
        <header className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold">MarIA</h1>
          <button onClick={() => setIsAuthModalOpen(true)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            Login / Sign Up
          </button>
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-6 py-24 text-center">
          <h2 className="text-5xl font-extrabold mb-4">Your Personal AI Assistant, Always Ready</h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            MarIA manages your tasks, reminders, notes, and more through natural conversation, so you can focus on what matters most.
          </p>
          <button onClick={() => setIsAuthModalOpen(true)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-transform transform hover:scale-105">
            Get Started for Free
          </button>
        </main>

        {/* Features Section */}
        <section className="bg-white dark:bg-gray-800/50 py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h3 className="text-4xl font-bold">Everything You Need to Be Organized</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">A powerful suite of tools integrated into one intelligent assistant.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard icon={ICONS.microphone} title="Natural Voice Commands">
                Speak naturally. MarIA understands context and carries out your requests in real-time.
              </FeatureCard>
              <FeatureCard icon={ICONS.reminders} title="Task Management">
                Never miss a deadline. Create, manage, and complete tasks with simple voice commands.
              </FeatureCard>
              <FeatureCard icon={ICONS.notes} title="Personal Knowledge Base">
                Save any piece of information and recall it instantly just by asking. Your second brain is here.
              </FeatureCard>
              <FeatureCard icon={ICONS.agenda} title="Calendar & Automations">
                Sync with your calendar and automate repetitive tasks to streamline your workflow.
              </FeatureCard>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white dark:bg-gray-800">
          <div className="container mx-auto px-6 py-8 text-center text-gray-600 dark:text-gray-500">
            <p>&copy; 2024 MarIA Personal Assistant. Powered by Google Gemini.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;