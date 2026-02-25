import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Permissions',
}

export default function Page() {
  return <PageClient />
}
