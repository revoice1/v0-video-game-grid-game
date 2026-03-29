import { notFound } from 'next/navigation'

import { ConfettiPageClient } from './confetti-page-client'

export default function ConfettiPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return <ConfettiPageClient />
}
