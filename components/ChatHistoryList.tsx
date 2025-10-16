import React from 'react'

export type HistoryItem = {
  id: string
  speaker: 'user' | 'maia'
  text: string
  created_at: string
}

export default function ChatHistoryList({ items }: { items: HistoryItem[] }) {
  if (!items || items.length === 0) return null
  return (
    <div className="space-y-2">
      {items.map((m) => (
        <div key={m.id} className="flex flex-col">
          <div className={`max-w-xl px-3 py-2 rounded-xl text-sm ${m.speaker === 'user' ? 'self-end bg-sky-100 text-sky-900' : 'self-start bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
            <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{m.speaker}</div>
            <div>{m.text}</div>
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
            {new Date(m.created_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}
