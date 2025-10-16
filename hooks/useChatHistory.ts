import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type ChatMessage = {
  id: string
  user_id: string
  speaker: 'user' | 'maia'
  text: string
  meta?: Record<string, any>
  created_at: string
}

export function useChatHistory(supabase: SupabaseClient) {
  const [items, setItems] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const fetchingRef = useRef(false)

  const latestBefore = useMemo(() => {
    if (items.length === 0) return undefined
    return items[items.length - 1].created_at
  }, [items])

  const load = useCallback(async (opts?: { limit?: number; before?: string }) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const limit = opts?.limit ?? 30
      const params = new URLSearchParams({ limit: String(limit) })
      if (opts?.before) params.set('before', opts.before)
      const { data, error } = await supabase.functions.invoke('list-chat-history', {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
        // @ts-ignore: supabase-js handles querystring via `body` for GET invoke
        body: null,
        // Workaround: use fetch directly to pass querystring
      })
      if (error) throw error
      // If using invoke GET without qs support, fallback to fetch
      let payload = data as any
      if (!payload?.items) {
        const url = new URL(`${supabase.supabaseUrl}/functions/v1/list-chat-history`)
        url.searchParams.set('limit', String(limit))
        if (opts?.before) url.searchParams.set('before', opts.before)
        const resp = await fetch(url.toString(), {
          headers: {
            'content-type': 'application/json',
            'Authorization': `Bearer ${(
              await supabase.auth.getSession()
            ).data.session?.access_token ?? ''}`,
          },
        })
        payload = await resp.json()
        if (!resp.ok) throw new Error(payload?.error || 'Failed to list history')
      }
      const newItems: ChatMessage[] = payload.items || []
      setItems((prev) => [...prev, ...newItems])
      setHasMore(newItems.length === (opts?.limit ?? 30))
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [supabase])

  const loadMore = useCallback(async () => {
    if (!hasMore) return
    await load({ before: latestBefore, limit: 30 })
  }, [hasMore, latestBefore, load])

  const postMessage = useCallback(async (msg: { speaker: 'user' | 'maia'; text: string; meta?: any }) => {
    // Optimistic
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      user_id: 'me',
      speaker: msg.speaker,
      text: msg.text,
      meta: msg.meta,
      created_at: new Date().toISOString(),
    }
    setItems((prev) => [temp, ...prev])

    const { data, error } = await supabase.functions.invoke('create-chat-message', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: msg,
    })
    if (error) throw error
    const saved = (data as any)?.message as ChatMessage
    // Replace temp with saved
    setItems((prev) => {
      const clone = [...prev]
      const idx = clone.findIndex((i) => i.id === temp.id)
      if (idx >= 0) clone[idx] = saved
      return clone
    })
    return saved
  }, [supabase])

  const reset = useCallback(() => {
    setItems([])
    setHasMore(true)
  }, [])

  return { items, loading, hasMore, load, loadMore, postMessage, reset }
}
