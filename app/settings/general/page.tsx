import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'General Settings',
}

export default function Page() {
  return <PageClient />
}
