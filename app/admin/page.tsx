import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Admin',
}

export default function Page() {
  return <PageClient />
}
