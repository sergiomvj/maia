import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { TranscriptEntry, Reminder, Note, ShoppingListItem, CalendarEvent, User, ServerToClientMessage, ChatHistoryEntry } from '../types';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { playSuccessSound } from '../utils/audioEffects';
import { PRIORITY_ORDER } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const SCRIPT_PROCESSOR_BUFFER_SIZE = 4096;

export const useGeminiLive = (user: User | null) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isProcessingTool, setIsProcessingTool] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const { t } = useLanguage();

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const pendingCitationsRef = useRef<any[] | null>(null);

  // Auto-clear error after a delay
  useEffect(() => {
    if (error) {
        const timer = setTimeout(() => {
            setError(null);
        }, 7000); // Clear error after 7 seconds
        return () => clearTimeout(timer);
    }
  }, [error]);

  // Fetch initial data from Supabase when user is available
  useEffect(() => {
    if (!user) {
      setIsLoadingData(false);
      // Clear data on logout
      setReminders([]);
      setNotes([]);
      setShoppingList([]);
      setTranscript([]);
      return;
    }

    const fetchAllData = async () => {
      setIsLoadingData(true);
      setError(null);
      try {
        const [remindersRes, notesRes, shoppingListRes, chatHistoryRes] = await Promise.all([
          supabase.from('reminders').select('*').order('created_at', { ascending: false }),
          supabase.from('notes').select('*').order('created_at', { ascending: false }),
          supabase.from('shopping_list_items').select('*').order('created_at', { ascending: false }),
          supabase.from('chat_history').select('*').order('created_at', { ascending: false }).limit(100)
        ]);

        if (remindersRes.error) throw new Error(`Reminders: ${remindersRes.error.message}`);
        setReminders(remindersRes.data || []);
        
        if (notesRes.error) throw new Error(`Notes: ${notesRes.error.message}`);
        setNotes(notesRes.data || []);
        
        if (shoppingListRes.error) throw new Error(`Shopping List: ${shoppingListRes.error.message}`);
        setShoppingList(shoppingListRes.data || []);
        
        if (chatHistoryRes.error) throw new Error(`Chat History: ${chatHistoryRes.error.message}`);
        const loadedTranscript = (chatHistoryRes.data || []).reverse().map((entry: ChatHistoryEntry) => ({
            id: entry.id,
            speaker: entry.speaker,
            text: entry.text,
            isFinal: true,
        }));
        
        const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'there';
        const welcomeMessage: TranscriptEntry = {
            speaker: 'system',
            text: t('welcomeMessage', { userName }),
            isFinal: true,
        };
        setTranscript(prev => loadedTranscript.length > 0 ? loadedTranscript : [welcomeMessage]);

      } catch (err: any) {
        setError(`Failed to load data: ${err.message}`);
        console.error(err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchAllData();
  }, [user, t]);

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => {
      if (a.is_completed !== b.is_completed) {
        return a.is_completed ? 1 : -1;
      }
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });
  }, [reminders]);

  const saveTranscriptEntry = useCallback(async (entry: Omit<ChatHistoryEntry, 'id' | 'created_at' | 'user_id'>) => {
      if (!user) return;
      const { error } = await supabase.from('chat_history').insert({ ...entry, user_id: user.id });
      if (error) {
          console.error('Failed to save chat history:', error);
      }
  }, [user]);


  const toggleReminderCompletion = useCallback(async (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;
    const newStatus = !reminder.is_completed;
    setReminders(prev => prev.map(r => r.id === id ? { ...r, is_completed: newStatus } : r));
    const { error } = await supabase.from('reminders').update({ is_completed: newStatus }).eq('id', id);
    if (error) {
      console.error('Failed to update reminder:', error);
      setReminders(prev => prev.map(r => r.id === id ? { ...r, is_completed: !newStatus } : r));
      setError('Failed to update reminder.');
    }
  }, [reminders]);

  const deleteReminder = useCallback(async (id: string) => {
    const originalReminders = reminders;
    setReminders(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) {
        console.error('Failed to delete reminder:', error);
        setReminders(originalReminders);
        setError('Failed to delete reminder.');
    }
  }, [reminders]);

  const deleteNote = useCallback(async (id: string) => {
    const originalNotes = notes;
    setNotes(prev => prev.filter(note => note.id !== id));
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) {
      console.error('Failed to delete note:', error);
      setNotes(originalNotes);
      setError('Failed to delete note.');
    }
  }, [notes]);

  const addShoppingListItem = useCallback(async (item: string, quantity: number = 1) => {
    if (!user) return;
    const existingItem = shoppingList.find(i => i.item.toLowerCase() === item.toLowerCase());
    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        setShoppingList(prev => prev.map(i => i.id === existingItem.id ? { ...i, quantity: newQuantity } : i));
        const { error } = await supabase.from('shopping_list_items').update({ quantity: newQuantity }).eq('id', existingItem.id);
        if (error) {
            console.error('Failed to update shopping list item:', error);
            setShoppingList(prev => prev.map(i => i.id === existingItem.id ? { ...i, quantity: existingItem.quantity } : i));
        }
    } else {
        const { data, error } = await supabase.from('shopping_list_items').insert({ user_id: user.id, item, quantity }).select().single();
        if (error) {
            console.error('Failed to add shopping list item:', error);
        } else if (data) {
            setShoppingList(prev => [data, ...prev]);
        }
    }
  }, [shoppingList, user]);

  const removeShoppingListItem = useCallback(async (itemName: string) => {
    const itemToRemove = shoppingList.find(i => i.item.toLowerCase() === itemName.toLowerCase());
    if (!itemToRemove) return;
    const originalList = shoppingList;
    setShoppingList(prev => prev.filter(i => i.id !== itemToRemove.id));
    const { error } = await supabase.from('shopping_list_items').delete().eq('id', itemToRemove.id);
    if (error) {
        console.error('Failed to remove shopping list item:', error);
        setShoppingList(originalList);
    }
  }, [shoppingList]);

  const toggleShoppingListItem = useCallback(async (id: string) => {
    const item = shoppingList.find(i => i.id === id);
    if (!item) return;
    const newStatus = !item.is_collected;
    setShoppingList(prev => prev.map(i => i.id === id ? { ...i, is_collected: newStatus } : i));
    const { error } = await supabase.from('shopping_list_items').update({ is_collected: newStatus }).eq('id', id);
    if (error) {
      console.error('Failed to update shopping list item:', error);
      setShoppingList(prev => prev.map(i => i.id === id ? { ...i, is_collected: !newStatus } : i));
    }
  }, [shoppingList]);

  const cleanup = useCallback(() => {
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    mediaStreamSourceRef.current?.disconnect();
    mediaStreamSourceRef.current = null;
    inputAudioContextRef.current?.close().catch(console.error);
    inputAudioContextRef.current = null;
    playbackQueueRef.current.forEach(source => source.stop());
    playbackQueueRef.current.clear();
    outputAudioContextRef.current?.close().catch(console.error);
    outputAudioContextRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setIsProcessingTool(false);
    nextStartTimeRef.current = 0;
  }, []);

  const closeSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanup();
  }, [cleanup]);

  const handleToolCall = useCallback(async (toolCall: any) => {
    if (!user) return;
    setIsProcessingTool(true);
    let toolResponseResult: any = "ok";
    let systemMessageText: string | null = null;
        
    try {
        // --- Existing Features ---
        if (toolCall.name === 'createReminder') {
            const { task, dueDate, dueTime, priority } = toolCall.args as { task: string; dueDate?: string; dueTime?: string, priority?: 'High' | 'Medium' | 'Low' };
            const { data: newReminder, error } = await supabase.from('reminders').insert({ task, due_date: dueDate, due_time: dueTime, priority: priority || 'Medium', user_id: user.id }).select().single();
            if (error) { console.error('DB Error:', error); toolResponseResult = "Failed to save reminder."; }
            else if (newReminder) { setReminders(prev => [newReminder, ...prev]); systemMessageText = t('reminderSet', { task }); playSuccessSound(); }
        } else if (toolCall.name === 'saveNote') {
            const { content } = toolCall.args as { content: string };
            const { data: newNote, error } = await supabase.from('notes').insert({ content, user_id: user.id }).select().single();
            if (error) { console.error('DB Error:', error); toolResponseResult = "Failed to save note."; }
            else if (newNote) { setNotes(prev => [newNote, ...prev]); systemMessageText = t('noteSaved'); playSuccessSound(); }
        } else if (toolCall.name === 'addShoppingListItem') {
            const { item, quantity } = toolCall.args as { item: string; quantity?: number };
            await addShoppingListItem(item, quantity);
            systemMessageText = t('shoppingListItemAdded', { item });
        } else if (toolCall.name === 'removeShoppingListItem') {
            const { item } = toolCall.args as { item: string };
            await removeShoppingListItem(item);
            systemMessageText = t('shoppingListItemRemoved', { item });
        } 
        
        // --- New Real-Time Information Features ---
        else if (toolCall.name === 'performWebSearch' || toolCall.name === 'getLatestNews' || toolCall.name === 'getWeather' || toolCall.name === 'findProductPrice') {
            const query = toolCall.args.query || toolCall.args.topic || `weather in ${toolCall.args.city}` || `price of ${toolCall.args.productName}`;
            systemMessageText = t('webSearchInProgress', { query });
            try {
                const { data, error } = await supabase.functions.invoke('generate-grounded-content', {
                    body: { query },
                });
                if (error) throw error;
                toolResponseResult = data.text || "I couldn't find anything about that.";
                if (data.citations && data.citations.length > 0) {
                    pendingCitationsRef.current = data.citations;
                }
            } catch (err: any) {
                console.error("Web search error:", err);
                toolResponseResult = "Sorry, I had trouble searching for that.";
            }
        }
        
        // --- Image Generation ---
        else if (toolCall.name === 'generateImage') {
            const { prompt, negativePrompt } = toolCall.args as { prompt: string, negativePrompt?: string };
            const placeholderId = `img-placeholder-${Date.now()}`;
            const placeholderEntry: TranscriptEntry = {
                id: placeholderId,
                speaker: 'maia',
                text: t('imageGenerationInProgress'),
                isFinal: false,
                imageData: 'loading',
            };
            setTranscript(prev => [...prev, placeholderEntry]);

            try {
                const { data, error } = await supabase.functions.invoke('generate-image', {
                    body: { prompt, negativePrompt },
                });

                if (error) throw error;

                const imageText = negativePrompt
                    ? t('imageGeneratedWithNegative', { prompt, negativePrompt })
                    : t('imageGenerated', { prompt });
                
                const newImageEntry: TranscriptEntry = {
                    speaker: 'maia',
                    text: imageText,
                    imageData: data.imageData,
                    isFinal: true,
                };
                
                setTranscript(prev => {
                    const newTranscript = prev.map(entry => entry.id === placeholderId ? newImageEntry : entry);
                    saveTranscriptEntry({ speaker: newImageEntry.speaker, text: newImageEntry.text });
                    return newTranscript;
                });
                toolResponseResult = "Image generated and displayed successfully.";

            } catch (err: any) {
                console.error("Image generation error:", err);
                toolResponseResult = "Sorry, I had trouble generating that image.";
                setTranscript(prev => prev.filter(entry => entry.id !== placeholderId));
                setError(toolResponseResult);
            }
            systemMessageText = null; // We handled UI updates with the placeholder
        }

        // --- New Mocked Integration Features ---
        else if (toolCall.name === 'controlSmartDevice') {
            const { deviceName, action, value } = toolCall.args;
            systemMessageText = t('simulatedAction', { action: `Device '${deviceName}' turned ${action} ${value ? `to ${value}`: ''}`.trim() });
        } else if (toolCall.name === 'createCalendarEvent') {
            const { title, date, time } = toolCall.args;
            systemMessageText = t('simulatedAction', { action: `Event '${title}' created for ${date} at ${time}` });
        } else if (toolCall.name === 'sendEmail') {
            const { recipient } = toolCall.args;
            systemMessageText = t('simulatedAction', { action: `Email sent to ${recipient}` });
        } else if (toolCall.name === 'sendSlackMessage') {
            const { channel } = toolCall.args;
            systemMessageText = t('simulatedAction', { action: `Message sent to Slack channel ${channel}` });
        } else if (toolCall.name === 'orderPizza') {
            const { size, toppings } = toolCall.args;
            systemMessageText = t('simulatedAction', { action: `Ordered a ${size} pizza with ${toppings.join(', ')}` });
        } else if (toolCall.name === 'getSalesData') {
            toolResponseResult = "This quarter's sales are up 15% to $1.2M.";
            systemMessageText = t('simulatedAction', { action: `Fetched sales data` });
        } else if (toolCall.name === 'getSupportTicket') {
            const { ticketId } = toolCall.args;
            toolResponseResult = `Ticket ${ticketId} is open and assigned to Kevin. The issue is 'Cannot log in'.`;
            systemMessageText = t('simulatedAction', { action: `Fetched support ticket ${ticketId}` });
        }

        
        if(systemMessageText) {
             const newSystemEntry: TranscriptEntry = { speaker: 'system', text: systemMessageText, isFinal: true };
             setTranscript(prev => [...prev, newSystemEntry]);
             saveTranscriptEntry(newSystemEntry);
        }

    } catch (err: any) {
        console.error("Tool call processing error:", err);
        setError(`An error occurred: ${err.message}`);
        toolResponseResult = `Error: ${err.message}`;
    } finally {
        if (wsRef.current) {
            const response = { type: 'toolResponse', payload: { functionResponses: { id: toolCall.id, name: toolCall.name, response: { result: toolResponseResult } } } };
            wsRef.current.send(JSON.stringify(response));
        }
        setIsProcessingTool(false);
    }
  }, [user, addShoppingListItem, removeShoppingListItem, t, saveTranscriptEntry]);

  const startSession = useCallback(async () => {
    if (isConnecting || isConnected) return;
    setError(null);
    setIsConnecting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("You must be logged in to start a session.");
        setIsConnecting(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
      
      const supabaseUrl = new URL(supabase.realtime.conn?.url ?? '');
      const wsUrl = `wss://${supabaseUrl.hostname}/functions/v1/proxy-live-session`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token: session.access_token }));
      };

      ws.onmessage = async (event) => {
        const message: ServerToClientMessage = JSON.parse(event.data);
        
        if (message.type === 'connectionReady') {
            setIsConnected(true);
            setIsConnecting(false);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            mediaStreamSourceRef.current = source;
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER_SIZE, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                 wsRef.current.send(JSON.stringify({ type: 'audio', payload: pcmBlob }));
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
        } else if (message.type === 'error') {
            setError(message.payload);
            closeSession();
        } else if (message.type === 'toolCall') {
            handleToolCall(message.payload);
        } else if (message.type === 'transcription') {
            const { speaker, text, isFinal, kind } = message.payload;
            
            setTranscript(prev => {
                const last = prev[prev.length - 1];
                // If the last entry is for the same speaker and isn't final yet, append the text.
                if (last?.speaker === speaker && !last.isFinal) {
                    const updatedEntry = { ...last, text: last.text + text };
                    if (isFinal) {
                        updatedEntry.isFinal = true;
                        // If this is Maia's final response and there are citations pending, attach them.
                        if (speaker === 'maia' && pendingCitationsRef.current) {
                            updatedEntry.citations = pendingCitationsRef.current;
                            pendingCitationsRef.current = null; // Clear after use
                        }
                        saveTranscriptEntry({ speaker, text: updatedEntry.text });
                    }
                    return [...prev.slice(0, -1), updatedEntry];
                }
                
                // Otherwise, create a new transcript entry.
                const newEntry: TranscriptEntry = { speaker, text, isFinal };
                if (isFinal) {
                    if (speaker === 'maia' && pendingCitationsRef.current) {
                        newEntry.citations = pendingCitationsRef.current;
                        pendingCitationsRef.current = null;
                    }
                    saveTranscriptEntry({ speaker, text: newEntry.text });
                }
                return [...prev, newEntry];
            });

            if (kind === 'output') {
                 setIsSpeaking(true);
            }

        } else if (message.type === 'audio') {
            const base64EncodedAudioString = message.payload.data;
            if (base64EncodedAudioString && outputAudioContextRef.current) {
                setIsSpeaking(true);
                const decodedAudio = decode(base64EncodedAudioString);
                const audioBuffer = await decodeAudioData(decodedAudio, outputAudioContextRef.current, OUTPUT_SAMPLE_RATE, 1);
                const source = outputAudioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputAudioContextRef.current.destination);
                const currentTime = outputAudioContextRef.current.currentTime;
                const startTime = Math.max(currentTime, nextStartTimeRef.current);
                source.start(startTime);
                nextStartTimeRef.current = startTime + audioBuffer.duration;
                playbackQueueRef.current.add(source);
                source.onended = () => {
                    playbackQueueRef.current.delete(source);
                    if (playbackQueueRef.current.size === 0) { setIsSpeaking(false); }
                };
            }
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error. Please check the console.');
        cleanup();
      };

      ws.onclose = () => {
        console.log('WebSocket closed.');
        cleanup();
      };

    } catch (err: any) {
      console.error('Failed to start session:', err);
      setError(`Failed to start session: ${err.message}`);
      cleanup();
    }
  }, [cleanup, handleToolCall, saveTranscriptEntry, isConnected, isConnecting, t]);

  return {
    isConnecting,
    isConnected,
    isSpeaking,
    isLoadingData,
    isProcessingTool,
    error,
    transcript,
    reminders: sortedReminders,
    notes,
    shoppingList,
    calendarEvents,
    startSession,
    closeSession,
    toggleReminderCompletion,
    deleteReminder,
    deleteNote,
    addShoppingListItem,
    removeShoppingListItem,
    toggleShoppingListItem,
  };
};