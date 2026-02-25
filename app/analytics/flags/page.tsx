import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Flags Analytics',
}

export default function Page() {
  return <PageClient />
}
