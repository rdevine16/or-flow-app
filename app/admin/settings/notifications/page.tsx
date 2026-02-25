import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Notifications',
}

export default function Page() {
  return <PageClient />
}
