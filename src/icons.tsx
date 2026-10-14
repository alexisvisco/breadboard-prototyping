// Petits pictogrammes partagés (Lucide).

import { Minus, Pencil, Plus } from 'lucide-react'

export function DiffSign({ type }: { type: 'add' | 'del' | 'mod' }) {
  const Icon = type === 'add' ? Plus : type === 'del' ? Minus : Pencil
  return <Icon className="mt-0.5 size-3.5" strokeWidth={3} />
}

export const LinkSign = ({ add }: { add: boolean }) => (add ? <Plus className="mr-1 inline size-3.5" /> : <Minus className="mr-1 inline size-3.5" />)
