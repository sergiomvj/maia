import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { User, Profile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import Icon from '../components/Icon';
import { ICONS } from '../constants';

const getFunctionsBaseUrl = () => {
  const url = (supabase as any)?.realtime?.conn?.url ?? '';
  try { const u = new URL(url); return `https://${u.hostname}/functions/v1`; } catch { return ''; }
};

const authHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } as Record<string, string>;
};

const efFetch = async (path: string, init: RequestInit) => {
  const headers = await authHeaders();
  const res = await fetch(`${getFunctionsBaseUrl()}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  if (!res.ok) { const text = await res.text(); throw new Error(text || `Request failed: ${res.status}`); }
  return res;
};

interface ProfilePageProps {
  user: User;
  onLogout: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [email, setEmail] = useState('');
  const [llmProvider, setLlmProvider] = useState<Profile['llm_provider']>('gemini');
  const [apiKeySet, setApiKeySet] = useState<boolean>(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { t } = useLanguage();
  const [language, setLanguage] = useState<'pt-BR' | 'en' | 'es'>('pt-BR');
  const [connections, setConnections] = useState<{[k: string]: boolean}>({ google: false, notion: false, spotify: false, meta: false });
  const [payPassphrase, setPayPassphrase] = useState('');
  const [payDuress, setPayDuress] = useState('');

  const refreshConnections = async () => {
    try {
      const res = await efFetch('/oauth-status', { method: 'GET' });
      const json = await res.json();
      const flags = (json?.data || {}) as { [k: string]: boolean };
      setConnections({
        google: !!flags.google,
        notion: !!flags.notion,
        spotify: !!flags.spotify,
        meta: !!flags.meta,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePassphrases = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      if (!payPassphrase || payPassphrase.length < 6) {
        throw new Error('A senha de segurança deve ter ao menos 6 caracteres.');
      }
      const res = await efFetch('/payments-set-passphrase', {
        method: 'POST',
        body: JSON.stringify({ passphrase: payPassphrase, duress_passphrase: payDuress || undefined })
      });
      await res.json();
      setMessage('Senhas de pagamento salvas com sucesso.');
      setPayPassphrase('');
      setPayDuress('');
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar as senhas de pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${getFunctionsBaseUrl()}/oauth-google/start`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
        redirect: 'manual' as RequestRedirect,
      });
      const loc = res.headers.get('Location');
      if (loc) {
        window.location.href = loc;
        return;
      }
      throw new Error('Missing redirect');
    } catch (e) {
      setError('Falha ao iniciar conexão com Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (provider: 'google'|'notion'|'spotify'|'meta') => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await efFetch('/oauth-disconnect', { method: 'DELETE', body: JSON.stringify({ provider }) });
      await res.json();
      await refreshConnections();
      setMessage(`Desconectado de ${provider}.`);
    } catch (e) {
      setError('Falha ao desconectar.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectNotion = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${getFunctionsBaseUrl()}/oauth-notion/start`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
        redirect: 'manual' as RequestRedirect,
      });
      const loc = res.headers.get('Location');
      if (loc) {
        window.location.href = loc;
        return;
      }
      throw new Error('Missing redirect');
    } catch (e) {
      setError('Falha ao iniciar conexão com Notion.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSpotify = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${getFunctionsBaseUrl()}/oauth-spotify/start`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
        redirect: 'manual' as RequestRedirect,
      });
      const loc = res.headers.get('Location');
      if (loc) {
        window.location.href = loc;
        return;
      }
      throw new Error('Missing redirect');
    } catch (e) {
      setError('Falha ao iniciar conexão com Spotify.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectMeta = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${getFunctionsBaseUrl()}/oauth-meta/start`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
        redirect: 'manual' as RequestRedirect,
      });
      const loc = res.headers.get('Location');
      if (loc) {
        window.location.href = loc;
        return;
      }
      throw new Error('Missing redirect');
    } catch (e) {
      setError('Falha ao iniciar conexão com Meta (Facebook/Instagram).');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await efFetch('/profile', { method: 'GET' });
        const json = await res.json();
        const data = json.data as { full_name?: string; llm_provider?: string; language?: 'pt-BR'|'en'|'es' } | null;
        if (data) {
          setFullName(data.full_name || '');
          setLlmProvider((data.llm_provider as any) || 'gemini');
          setLanguage((data.language as any) || 'pt-BR');
        }
        setEmail(user.email || '');

        // Load Admin Area data: llm_provider/api_key_set/privacidade/assistente
        try {
          const admRes = await efFetch('/get-profile-admin', { method: 'GET' });
          const adm = await admRes.json();
          if (adm?.llm_provider) setLlmProvider(adm.llm_provider as any);
          setApiKeySet(!!adm?.api_key_set);
          // (Opcional) Poderíamos preencher privacidade/assistente aqui se exibirmos UI específica
        } catch {}
      } catch (e) {
        setError(t('profileLoadError'));
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    refreshConnections();
  }, [user, t]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
        await efFetch('/profile', { method: 'PUT', body: JSON.stringify({ full_name: fullName, llm_provider: llmProvider, language }) });

        // Update name in auth.users user_metadata
        const { error: userError } = await supabase.auth.updateUser({
            data: { full_name: fullName }
        });

        if (userError) throw userError;

        setMessage(t('profileUpdateSuccess'));
        
    } catch (err: any) {
        setError(err.message || 'Failed to update profile.');
    } finally {
        setLoading(false);
    }
  };

  const handleUpdateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
        const body: any = { llm_provider: llmProvider };
        if (apiKey) body.api_key_plain = apiKey;
        const res = await efFetch('/update-profile-admin', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        await res.json();
        setMessage(apiKey ? t('profileApiKeySaveSuccess') : t('profileSaveChanges'));
        if (apiKey) {
          setApiKey('');
          setApiKeySet(true);
        }

    } catch (err: any) {
        setError(err.message || 'Failed to save API key.');
    } finally {
        setLoading(false);
    }
  };
  
  const providerLabels: {[key: string]: string} = {
    gemini: "Google Gemini",
    openai: "OpenAI",
    anthropic: "Anthropic"
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">{t('profileTitle')}</h2>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Profile Details Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4 sm:p-6 md:p-8">
            <h3 className="text-xl font-semibold mb-6">{t('profilePersonalInfo')}</h3>
            {loading ? (
                <div className="text-center text-gray-500 dark:text-gray-400">{t('profileLoading')}</div>
            ) : (
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    {error && <div className="p-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800 text-sm">{error}</div>}
                    {message && !error && <div className="p-3 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-md border border-green-200 dark:border-green-800 text-sm">{message}</div>}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('profileEmailLabel')}</label>
                        <div className="mt-1">
                            <input
                                id="email"
                                type="email"
                                value={email}
                                disabled
                                className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                            />
                        </div>

        {/* Payments Security */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4 sm:p-6 md:p-8 mt-8">
          <h3 className="text-xl font-semibold mb-2">Segurança de Pagamentos</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Defina uma senha de segurança para autorizar pagamentos e uma senha de coação (opcional) que bloqueia operações e dispara auditoria.</p>
          <form onSubmit={handleSavePassphrases} className="space-y-6">
            <div>
              <label htmlFor="payPassphrase" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Senha de segurança</label>
              <div className="mt-1">
                <input
                  id="payPassphrase"
                  type="password"
                  value={payPassphrase}
                  onChange={(e) => setPayPassphrase(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="payDuress" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Senha de coação (opcional)</label>
              <div className="mt-1">
                <input
                  id="payDuress"
                  type="password"
                  value={payDuress}
                  onChange={(e) => setPayDuress(e.target.value)}
                  placeholder="Usada em caso de coação para bloquear operações"
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Salvando…' : 'Salvar senhas'}
              </button>
            </div>
          </form>
        </div>
                    </div>

                    <div className="pt-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Google {connections.google ? '· Conectado' : '· Desconectado'}</span>
                            <button
                                type="button"
                                onClick={handleConnectGoogle}
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Conectar Google
                            </button>
                            {connections.google && (
                              <button
                                type="button"
                                onClick={() => handleDisconnect('google')}
                                disabled={loading}
                                className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-900 dark:text-gray-800 font-semibold py-2 px-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Desconectar
                              </button>
                            )}
                        </div>
                    </div>

                    <div className="pt-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Notion {connections.notion ? '· Conectado' : '· Desconectado'}</span>
                            <button
                                type="button"
                                onClick={handleConnectNotion}
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Conectar Notion
                            </button>
                            {connections.notion && (
                              <button
                                type="button"
                                onClick={() => handleDisconnect('notion')}
                                disabled={loading}
                                className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-900 dark:text-gray-800 font-semibold py-2 px-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Desconectar
                              </button>
                            )}
                        </div>
                    </div>

                    <div className="pt-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Spotify {connections.spotify ? '· Conectado' : '· Desconectado'}</span>
                            <button
                                type="button"
                                onClick={handleConnectSpotify}
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Conectar Spotify
                            </button>
                            {connections.spotify && (
                              <button
                                type="button"
                                onClick={() => handleDisconnect('spotify')}
                                disabled={loading}
                                className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-900 dark:text-gray-800 font-semibold py-2 px-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Desconectar
                              </button>
                            )}
                        </div>
                    </div>

                    <div className="pt-3 pb-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Meta (Facebook/Instagram) {connections.meta ? '· Conectado' : '· Desconectado'}</span>
                            <button
                                type="button"
                                onClick={handleConnectMeta}
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Conectar Meta
                            </button>
                            {connections.meta && (
                              <button
                                type="button"
                                onClick={() => handleDisconnect('meta')}
                                disabled={loading}
                                className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-900 dark:text-gray-800 font-semibold py-2 px-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Desconectar
                              </button>
                            )}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('profileNameLabel')}</label>
                        <div className="mt-1">
                            <input
                                id="fullName"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder={t('profileNamePlaceholder')}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('profileLanguage')}</label>
                        <div className="mt-1">
                            <select
                                id="language"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as any)}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="pt-BR">Português (Brasil)</option>
                                <option value="en">English</option>
                                <option value="es">Español</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? t('profileSaving') : t('profileSaveChanges')}
                        </button>
                    </div>
                </form>
            )}
        </div>
        
        {/* API Key Form */}
         <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4 sm:p-6 md:p-8">
            <h3 className="text-xl font-semibold mb-2">{t('profileProviderSettings')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {t('profileApiNote')}
            </p>
            <form onSubmit={handleUpdateApiKey} className="space-y-6">
                 <div>
                    <label htmlFor="llmProvider" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('profileLlmProvider')}</label>
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
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('profileApiKeyLabel', { provider: providerLabels[llmProvider!] })}</label>
                    <div className="mt-1 relative">
                        <input
                            id="apiKey"
                            type={showApiKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={t('profileApiKeyPlaceholder')}
                            className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 pr-10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                         <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
                            aria-label={showApiKey ? t('profileHideApiKey') : t('profileShowApiKey')}
                        >
                            <Icon path={showApiKey ? ICONS.eyeSlash : ICONS.eye} className="w-5 h-5" />
                        </button>
                        {apiKeySet && (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400">Chave já configurada para o provider atual.</div>
                        )}
                    </div>
                </div>
                 <div className="flex justify-between items-center">
                     <p className="text-sm text-gray-500">{t('profileApiSessionNote')}</p>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? t('profileSaving') : t('profileSaveApiKey')}
                    </button>
                </div>
            </form>
         </div>

         {/* Danger Zone */}
         <div className="mt-8 p-4 sm:p-6 md:p-8 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/50">
            <h3 className="text-xl font-semibold text-red-800 dark:text-red-200">{t('profileDangerZone')}</h3>
            <p className="text-sm text-red-600 dark:text-red-300 mt-2 mb-6">{t('profileLogoutInfo')}</p>
            <button
                onClick={onLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors w-full sm:w-auto"
            >
                {t('navLogout')}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;