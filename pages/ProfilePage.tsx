import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { User, Profile } from '../types';

interface ProfilePageProps {
  user: User;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [llmProvider, setLlmProvider] = useState<Profile['llm_provider']>('gemini');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, llm_provider')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // Ignore error for no rows found
             throw error;
        }
        
        if (data) {
          setFullName(data.full_name || '');
          setLlmProvider(data.llm_provider || 'gemini');
        }
        setEmail(user.email || '');

      } catch (err: any) {
        setError('Failed to load profile. Please ensure you have set up the `profiles` table in Supabase as per the instructions in `supabaseClient.ts`.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
        // Update name and provider in profiles table using upsert
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ id: user.id, full_name: fullName, llm_provider: llmProvider, updated_at: new Date().toISOString() });
            
        if (profileError) throw profileError;

        // Update name in auth.users user_metadata
        const { error: userError } = await supabase.auth.updateUser({
            data: { full_name: fullName }
        });

        if (userError) throw userError;

        setMessage('Profile updated successfully!');
        
    } catch (err: any) {
        setError(err.message || 'Failed to update profile.');
    } finally {
        setLoading(false);
    }
  };

  const handleUpdateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
      setError('Please enter an API key.');
      return;
    }
    setLoading(true);
    setMessage('');
    setError('');

    try {
        const { error } = await supabase.functions.invoke('save-api-key', {
            body: { apiKey },
        });

        if (error) throw error;
        
        setMessage('API Key saved securely. Please start a new session for it to take effect.');
        setApiKey('');

    } catch (err: any) {
        setError(err.message || 'Failed to save API key.');
    } finally {
        setLoading(false);
    }
  };
  
  const providerLabels = {
    gemini: "Google Gemini",
    openai: "OpenAI",
    anthropic: "Anthropic"
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Your Profile</h2>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Profile Details Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-8">
            <h3 className="text-xl font-semibold mb-6">Personal Information</h3>
            {loading ? (
                <div className="text-center text-gray-500 dark:text-gray-400">Loading profile...</div>
            ) : (
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    {error && <div className="p-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800 text-sm">{error}</div>}
                    {message && !error && <div className="p-3 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-md border border-green-200 dark:border-green-800 text-sm">{message}</div>}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                        <div className="mt-1">
                            <input
                                id="email"
                                type="email"
                                value={email}
                                disabled
                                className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                        <div className="mt-1">
                            <input
                                id="fullName"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Your Name"
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            )}
        </div>
        
        {/* API Key Form */}
         <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-8">
            <h3 className="text-xl font-semibold mb-2">Provider Settings</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Your API key is encrypted and stored securely on the server. It is never exposed to the browser.
            </p>
            <form onSubmit={handleUpdateApiKey} className="space-y-6">
                 <div>
                    <label htmlFor="llmProvider" className="block text-sm font-medium text-gray-700 dark:text-gray-300">LLM Provider</label>
                    <div className="mt-1">
                        <select
                            id="llmProvider"
                            value={llmProvider}
                            onChange={(e) => setLlmProvider(e.target.value as Profile['llm_provider'])}
                            className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic (Coming Soon)</option>
                        </select>
                    </div>
                </div>
                 <div>
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{providerLabels[llmProvider!]} API Key</label>
                    <div className="mt-1">
                        <input
                            id="apiKey"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter your new API key"
                            className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                </div>
                 <div className="flex justify-between items-center">
                     <p className="text-sm text-gray-500">Changes to Provider or API key require a new session.</p>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : 'Save API Key'}
                    </button>
                </div>
            </form>
         </div>
      </div>
    </div>
  );
};

export default ProfilePage;