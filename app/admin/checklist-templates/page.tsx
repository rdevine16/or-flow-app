import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Checklist Templates',
}

export default function Page() {
  return <PageClient />
}
