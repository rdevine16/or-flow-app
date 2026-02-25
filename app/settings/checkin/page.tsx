import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Check-In Settings',
}

export default function Page() {
  return <PageClient />
}
