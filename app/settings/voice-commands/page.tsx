import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Voice Commands',
}

export default function Page() {
  return <PageClient />
}
