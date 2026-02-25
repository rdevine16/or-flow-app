import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Surgeon Preferences',
}

export default function Page() {
  return <PageClient />
}
