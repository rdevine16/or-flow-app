import { Metadata } from 'next'
import GlobalPageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Voice Templates (Global)',
}

export default function Page() {
  return <GlobalPageClient />
}
