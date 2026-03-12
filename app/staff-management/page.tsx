import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Staff Management',
}

export default function Page() {
  return <PageClient />
}
