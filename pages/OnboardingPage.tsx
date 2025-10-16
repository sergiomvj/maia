import React, { useCallback, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useOnboardingPreferences } from '../hooks/useOnboardingPreferences'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export default function OnboardingPage() {
  const { prefs, setPrefs, loading, saving, error, save } = useOnboardingPreferences()
  const [status, setStatus] = useState<string | null>(null)

  const updateField = useCallback((path: string, value: any) => {
    setPrefs((prev: any) => {
      const next = { ...(prev || {}) }
      const parts = path.split('.')
      let cur: any = next
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = cur[parts[i]] ?? {}
        cur = cur[parts[i]]
      }
      cur[parts[parts.length - 1]] = value
      return next
    })
  }, [setPrefs])

  const onSave = useCallback(async (patch: any) => {
    setStatus(null)
    await save(patch)
    setStatus('salvo')
    setTimeout(() => setStatus(null), 1500)
  }, [save])

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Onboarding Inteligente</h1>
      {error && <div className="mb-3 p-3 rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 text-sm">{error}</div>}
      {loading && <div className="mb-3 text-sm text-gray-500">Carregando preferências...</div>}
      {status && <div className="mb-3 text-sm text-green-600">Preferências salvas.</div>}

      <Section title="Identidade">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Nome preferido
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.identidade?.nome_preferido || ''} onChange={(e) => updateField('identidade.nome_preferido', e.target.value)} />
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Pronomes
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.identidade?.pronomes || ''} onChange={(e) => updateField('identidade.pronomes', e.target.value)} />
          </label>
        </div>
        <button disabled={saving} onClick={() => onSave({ identidade: prefs?.identidade })} className="text-xs px-3 py-1 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">Salvar Identidade</button>
      </Section>

      <Section title="Rotina">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Acorda (HH:MM)
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.rotina?.acorda || ''} onChange={(e) => updateField('rotina.acorda', e.target.value)} />
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Dorme (HH:MM)
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.rotina?.dorme || ''} onChange={(e) => updateField('rotina.dorme', e.target.value)} />
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Treino (ex.: seg/qua/sex)
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.rotina?.treino || ''} onChange={(e) => updateField('rotina.treino', e.target.value)} />
          </label>
        </div>
        <button disabled={saving} onClick={() => onSave({ rotina: prefs?.rotina })} className="text-xs px-3 py-1 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">Salvar Rotina</button>
      </Section>

      <Section title="Preferências">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Café
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.preferencias?.cafe || ''} onChange={(e) => updateField('preferencias.cafe', e.target.value)} />
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Música
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.preferencias?.musica || ''} onChange={(e) => updateField('preferencias.musica', e.target.value)} />
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Idioma
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.preferencias?.idioma || ''} onChange={(e) => updateField('preferencias.idioma', e.target.value)} />
          </label>
        </div>
        <button disabled={saving} onClick={() => onSave({ preferencias: prefs?.preferencias })} className="text-xs px-3 py-1 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">Salvar Preferências</button>
      </Section>

      <Section title="Locais">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Cidade
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.locais?.cidade || ''} onChange={(e) => updateField('locais.cidade', e.target.value)} />
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            País
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.locais?.pais || ''} onChange={(e) => updateField('locais.pais', e.target.value)} />
          </label>
        </div>
        <button disabled={saving} onClick={() => onSave({ locais: prefs?.locais })} className="text-xs px-3 py-1 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">Salvar Locais</button>
      </Section>

      <Section title="Notificações">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
            <input type="checkbox" checked={!!prefs?.notificacoes?.silencio_noite} onChange={(e) => updateField('notificacoes.silencio_noite', e.target.checked)} /> Silenciar à noite
          </label>
        </div>
        <button disabled={saving} onClick={() => onSave({ notificacoes: prefs?.notificacoes })} className="text-xs px-3 py-1 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">Salvar Notificações</button>
      </Section>

      <Section title="Privacidade">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
            <input type="checkbox" checked={!!prefs?.privacidade?.compartilhar_dados} onChange={(e) => updateField('privacidade.compartilhar_dados', e.target.checked)} /> Compartilhar dados para melhoria
          </label>
        </div>
        <button disabled={saving} onClick={() => onSave({ privacidade: prefs?.privacidade })} className="text-xs px-3 py-1 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">Salvar Privacidade</button>
      </Section>

      <Section title="Assistente">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Tom da assistente
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.assistente?.tom || ''} onChange={(e) => updateField('assistente.tom', e.target.value)} />
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Estilo de fala
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.assistente?.estilo || ''} onChange={(e) => updateField('assistente.estilo', e.target.value)} />
          </label>
        </div>
        <button disabled={saving} onClick={() => onSave({ assistente: prefs?.assistente })} className="text-xs px-3 py-1 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">Salvar Assistente</button>
      </Section>

      <Section title="Metas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Saúde
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.metas?.saude || ''} onChange={(e) => updateField('metas.saude', e.target.value)} />
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Carreira
            <input className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" value={prefs?.metas?.carreira || ''} onChange={(e) => updateField('metas.carreira', e.target.value)} />
          </label>
        </div>
        <button disabled={saving} onClick={() => onSave({ metas: prefs?.metas })} className="text-xs px-3 py-1 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">Salvar Metas</button>
      </Section>

      <div className="flex justify-end mt-8">
        <button disabled={saving} onClick={() => onSave(prefs || {})} className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Salvar tudo</button>
      </div>
    </div>
  )
}
