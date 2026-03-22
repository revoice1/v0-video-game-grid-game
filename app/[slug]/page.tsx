import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { IndexEchoPage } from '@/components/game/index-echo-page'
import { IndexNearMissPage } from '@/components/game/index-near-miss-page'
import { ROUTE_SLUG } from '@/lib/route-index'

export const metadata: Metadata = {
  title: 'Hidden Route',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function IndexedRoutePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  if (slug.toUpperCase() !== ROUTE_SLUG) {
    notFound()
  }

  if (slug !== ROUTE_SLUG) {
    return <IndexNearMissPage attemptedSlug={slug} />
  }

  return <IndexEchoPage />
}
