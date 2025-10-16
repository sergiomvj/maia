import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

type Prefs = {
  identidade?: any
  rotina?: any
  preferencias?: any
  locais?: any
  notificacoes?: any
  privacidade?: any
  assistente?: any
  metas?: any
}

export function useOnboardingPreferences() {
  const supabase = useMemo(() => createClient(
    (import.meta as any).env.VITE_SUPABASE_URL as string,
    (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string,
  ), [])

  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `${supabase.supabaseUrl}/functions/v1/get-onboarding-preferences`
      const token = (await supabase.auth.getSession()).data.session?.access_token || ''
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json?.error || 'Failed to load preferences')
      setPrefs(json.preferences || {})
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const save = useCallback(async (patch: Prefs) => {
    setSaving(true)
    setError(null)
    try {
      const url = `${supabase.supabaseUrl}/functions/v1/update-onboarding-preferences`
      const token = (await supabase.auth.getSession()).data.session?.access_token || ''
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json?.error || 'Failed to save preferences')
      setPrefs(json.preferences || {})
      return json.preferences
    } catch (e: any) {
      setError(e.message)
      throw e
    } finally {
      setSaving(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  return { prefs, loading, saving, error, load, save, setPrefs }
}
