import React from 'react';
import { CalendarEvent } from '../types';
import Icon from '../components/Icon';
import { ICONS } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface AgendaPageProps {
  events: CalendarEvent[];
}

const AgendaItem: React.FC<{ event: CalendarEvent, isLast: boolean }> = ({ event, isLast }) => (
    <div className="flex">
        <div className="flex flex-col items-center mr-4">
            <div>
                <div className="flex items-center justify-center w-10 h-10 border border-sky-500 rounded-full">
                    <Icon path={ICONS.reminders} className="w-5 h-5 text-sky-500" />
                </div>
            </div>
            {!isLast && <div className="w-px h-full bg-gray-300 dark:bg-gray-600"></div>}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 flex-1 border border-gray-200 dark:border-gray-700 shadow-sm">
            <p className="text-sky-500 dark:text-sky-400 font-semibold text-sm">{event.startTime} - {event.endTime}</p>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-1">{event.title}</h3>
            {event.description && <p className="text-gray-600 dark:text-gray-400 text-sm">{event.description}</p>}
        </div>
    </div>
);

const AgendaPage: React.FC<AgendaPageProps> = ({ events }) => {
  const { t } = useLanguage();
  return (
    <div className="p-8 h-full overflow-y-auto">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('agendaTitle')}</h2>
      {events.length > 0 ? (
        <div className="flow-root">
          <ul>
            {events.map((event, index) => (
                <li key={event.id}>
                    <AgendaItem event={event} isLast={index === events.length -1} />
                </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Icon path={ICONS.agenda} className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{t('agendaEmpty')}</h3>
            <p className="text-gray-600 dark:text-gray-400 mt-2">{t('agendaEmptyPrompt')}</p>
        </div>
      )}
    </div>
  );
};

export default AgendaPage;
