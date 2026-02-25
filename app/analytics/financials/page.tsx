import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Financial Analytics',
}

export default function Page() {
  return <PageClient />
}
