import React, { useEffect, useRef } from 'react';
import Icon from './Icon';
import Waveform from './Waveform';
import { ICONS, PRIORITY_COLORS } from '../constants';
import { TranscriptEntry, Reminder, Note } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';

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
        <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full">
          {entry.text}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
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
      </div>
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
    return (
        <div className="group flex items-start p-3 bg-gray-200/50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex-grow">
                <p className="text-sm text-gray-800 dark:text-gray-200">{note.content}</p>
                 <p className="text-xs text-gray-500 pt-1">{new Date(note.created_at).toLocaleString()}</p>
            </div>
            <button onClick={() => onDelete(note.id)} className="ml-4 flex-shrink-0 text-gray-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Delete note">
                <Icon path={ICONS.delete} className="w-5 h-5" />
            </button>
        </div>
    );
};


const ChatInterface: React.FC<ChatInterfaceProps> = ({ geminiLive }) => {
  const { isConnecting, isConnected, isSpeaking, isLoadingData, error, transcript, reminders, notes, startSession, closeSession, toggleReminderCompletion, deleteNote } = geminiLive;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

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
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 m-4">
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[45%]">
        {isLoadingData ? (
             <div className="text-center text-gray-500">Loading your data...</div>
        ) : (
            <>
            {reminders.length > 0 && (
              <div className="mb-4">
                  <div className="flex items-center mb-3">
                      <Icon path={ICONS.reminders} className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Active Reminders</h3>
                  </div>
                  <div className="space-y-2">
                      {activeReminders.map(r => <ReminderItem key={r.id} reminder={r} onToggle={toggleReminderCompletion} />)}
                      {activeReminders.length === 0 && <p className="text-xs text-gray-500 text-center py-2">All reminders completed!</p>}
                  </div>
                   {completedReminders.length > 0 && <details className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                      <summary className="text-xs text-gray-500 cursor-pointer">Completed ({completedReminders.length})</summary>
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
                      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Personal Notes</h3>
                  </div>
                  <div className="space-y-2">
                      {notes.map(n => <NoteItem key={n.id} note={n} onDelete={deleteNote} />)}
                  </div>
              </div>
            )}
            </>
        )}
      </div>
      
      <div ref={scrollRef} className="flex-grow p-6 space-y-4 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
        {transcript.length === 0 && !isConnected && !isLoadingData && (
            <div className="text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center h-full">
                <Icon path={ICONS.robot} className="w-16 h-16 mb-4 text-gray-400 dark:text-gray-500" />
                <h2 className="text-xl font-semibold">Ready to assist</h2>
                <p>Press the microphone button to start a conversation.</p>
            </div>
        )}
        {transcript.map((entry, index) => (
          <ChatBubble key={entry.id || index} entry={entry} />
        ))}
      </div>

      <div className="flex-shrink-0 p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {error && <div className="text-red-500 text-center mb-4 text-sm">{error}</div>}
        
        <div className="flex items-center justify-center space-x-4">
          <Waveform isActive={isConnected && !isSpeaking} colorClass="bg-gray-400 dark:bg-gray-500" />
          <button
            onClick={handleToggleConnection}
            aria-label={isConnected ? 'Stop session' : 'Start session'}
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