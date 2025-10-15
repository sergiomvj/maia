import React, { useEffect, useRef } from 'react';
import Icon from './Icon';
import Waveform from './Waveform';
import { ICONS, PRIORITY_COLORS } from '../constants';
import { TranscriptEntry, Reminder, Note } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { useLanguage } from '../contexts/LanguageContext';

type GeminiLiveHook = ReturnType<typeof useGeminiLive>;

interface ChatInterfaceProps {
    geminiLive: GeminiLiveHook;
}


const ChatBubble: React.FC<{ entry: TranscriptEntry }> = ({ entry }) => {
  const isUser = entry.speaker === 'user';
  const isSystem = entry.speaker === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full italic">
          {entry.text}
        </div>
      </div>
    );
  }

  return (
     <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
            className={`max-w-xl px-4 py-2 rounded-2xl text-white ${
            isUser
                ? 'bg-sky-600 rounded-br-none'
                : 'bg-gray-600 dark:bg-gray-700 rounded-bl-none'
            }`}
        >
            <p className={`text-sm ${entry.isFinal ? 'text-white' : 'text-gray-200 dark:text-gray-300'}`}>
            {entry.text}
            </p>
            {entry.imageData && (
                <div className="mt-2 p-1 bg-black/20 rounded-lg">
                    {entry.imageData === 'loading' ? (
                        <div className="rounded-md max-w-sm w-full aspect-square bg-gray-500/50 flex items-center justify-center animate-pulse">
                            <Icon path={ICONS.image} className="w-16 h-16 text-gray-400/80" />
                        </div>
                    ) : (
                        <img src={`data:image/png;base64,${entry.imageData}`} alt={entry.text} className="rounded-md max-w-sm w-full" />
                    )}
                </div>
            )}
        </div>

        {entry.citations && entry.citations.length > 0 && (
            <div className="mt-2 max-w-xl w-full">
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                <Icon path={ICONS.web} className="w-3.5 h-3.5 mr-1.5" />
                <span>Sources:</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {entry.citations.map((citation, index) => (
                <a 
                    href={citation.web.uri} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    key={index} 
                    className="bg-gray-200 dark:bg-gray-700 text-xs px-2 py-1 rounded-md hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 transition-colors truncate max-w-[150px] sm:max-w-xs block"
                    title={citation.web.title}
                >
                    {index + 1}. {citation.web.title || new URL(citation.web.uri).hostname}
                </a>
                ))}
            </div>
            </div>
        )}
    </div>
  );
};

const ReminderItem: React.FC<{ reminder: Reminder; onToggle: (id: string) => void }> = ({ reminder, onToggle }) => {
    return (
        <div className="flex items-center p-3 bg-gray-200/50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <button onClick={() => onToggle(reminder.id)} className="mr-4 flex-shrink-0" aria-label={`Mark ${reminder.is_completed ? 'incomplete' : 'complete'}`}>
                <Icon
                    path={reminder.is_completed ? ICONS.checkboxChecked : ICONS.checkboxUnchecked}
                    className={`w-6 h-6 ${reminder.is_completed ? 'text-green-500 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}
                />
            </button>
            <div className="flex-grow">
                 <div className="flex items-center">
                    <span className={`w-2.5 h-2.5 rounded-full mr-2 ${PRIORITY_COLORS[reminder.priority]}`} title={`Priority: ${reminder.priority}`}></span>
                    <p className={`text-sm ${reminder.is_completed ? 'line-through text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                        {reminder.task}
                    </p>
                </div>
                {(reminder.due_date || reminder.due_time) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 pl-[1.125rem]">
                        {reminder.due_date} {reminder.due_time}
                    </p>
                )}
            </div>
        </div>
    );
};

const NoteItem: React.FC<{ note: Note; onDelete: (id: string) => void }> = ({ note, onDelete }) => {
    const { t } = useLanguage();
    const handleDelete = () => {
        if (window.confirm(t('confirmDeleteNote'))) {
            onDelete(note.id);
        }
    };
    return (
        <div className="group flex items-start p-3 bg-gray-200/50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex-grow">
                <p className="text-sm text-gray-800 dark:text-gray-200">{note.content}</p>
                 <p className="text-xs text-gray-500 pt-1">{new Date(note.created_at).toLocaleString()}</p>
            </div>
            <button onClick={handleDelete} className="ml-4 flex-shrink-0 text-gray-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Delete note">
                <Icon path={ICONS.delete} className="w-5 h-5" />
            </button>
        </div>
    );
};


const ChatInterface: React.FC<ChatInterfaceProps> = ({ geminiLive }) => {
  const { isConnecting, isConnected, isSpeaking, isLoadingData, isProcessingTool, error, transcript, reminders, notes, startSession, closeSession, toggleReminderCompletion, deleteNote } = geminiLive;
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, isProcessingTool]);

  const handleToggleConnection = () => {
    if (isConnected || isConnecting) {
      closeSession();
    } else {
      startSession();
    }
  };

  const activeReminders = reminders.filter(r => !r.is_completed);
  const completedReminders = reminders.filter(r => r.is_completed);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 m-2 md:m-4">
      <div className="flex-shrink-0 p-3 md:p-4 border-b border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[50%] md:max-h-[45%]">
        {isLoadingData ? (
             <div className="text-center text-gray-500">{t('chatLoading')}</div>
        ) : (
            <>
            {reminders.length > 0 && (
              <div className="mb-4">
                  <div className="flex items-center mb-3">
                      <Icon path={ICONS.reminders} className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{t('chatActiveReminders')}</h3>
                  </div>
                  <div className="space-y-2">
                      {activeReminders.map(r => <ReminderItem key={r.id} reminder={r} onToggle={toggleReminderCompletion} />)}
                      {activeReminders.length === 0 && <p className="text-xs text-gray-500 text-center py-2">{t('chatAllRemindersDone')}</p>}
                  </div>
                   {completedReminders.length > 0 && <details className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                      <summary className="text-xs text-gray-500 cursor-pointer">{t('chatCompleted')} ({completedReminders.length})</summary>
                      <div className="space-y-2 mt-2">
                         {completedReminders.map(r => <ReminderItem key={r.id} reminder={r} onToggle={toggleReminderCompletion} />)}
                      </div>
                  </details>}
              </div>
            )}
            {notes.length > 0 && (
              <div>
                  <div className="flex items-center mb-3">
                      <Icon path={ICONS.notes} className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{t('chatNotes')}</h3>
                  </div>
                  <div className="space-y-2">
                      {notes.map(n => <NoteItem key={n.id} note={n} onDelete={deleteNote} />)}
                  </div>
              </div>
            )}
            </>
        )}
      </div>
      
      <div ref={scrollRef} className="flex-grow p-4 md:p-6 space-y-4 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
        {transcript.length === 0 && !isConnected && !isLoadingData && (
            <div className="text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center h-full">
                <Icon path={ICONS.robot} className="w-16 h-16 mb-4 text-gray-400 dark:text-gray-500" />
                <h2 className="text-xl font-semibold">{t('chatReady')}</h2>
                <p>{t('chatReadyPrompt')}</p>
            </div>
        )}
        {transcript.map((entry, index) => (
          <ChatBubble key={entry.id || index} entry={entry} />
        ))}
         {isProcessingTool && !transcript.some(e => e.imageData === 'loading') && (
            <div className="flex flex-col items-start">
                <div className="max-w-xl px-4 py-2 rounded-2xl text-white bg-gray-600 dark:bg-gray-700 rounded-bl-none animate-pulse">
                    <p className="text-sm italic">{t('chatThinking')}</p>
                </div>
            </div>
        )}
      </div>

      <div className="flex-shrink-0 p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {error && <div className="text-center mb-4 text-sm p-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg border border-red-300 dark:border-red-700">{error}</div>}
        
        <div className="flex items-center justify-center space-x-4">
          <Waveform isActive={isConnected && !isSpeaking} colorClass="bg-gray-400 dark:bg-gray-500" />
          <button
            onClick={handleToggleConnection}
            aria-label={isConnected ? t('chatStopSession') : t('chatStartSession')}
            disabled={isConnecting}
            className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 ${
              isConnected ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-600 hover:bg-sky-700'
            } text-white shadow-lg focus:outline-none focus:ring-4 focus:ring-opacity-50 ${
              isConnected ? 'focus:ring-red-500' : 'focus:ring-sky-500'
            } disabled:bg-gray-400 disabled:cursor-not-allowed`}
          >
            {isConnecting && (
                 <div className="absolute animate-spin rounded-full h-24 w-24 border-t-2 border-b-2 border-white"></div>
            )}
            {(isConnected && !isConnecting) && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            )}
            <Icon path={isConnected ? ICONS.stop : ICONS.microphone} className="w-8 h-8" />
          </button>
          <Waveform isActive={isSpeaking} colorClass="bg-green-500" />
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;