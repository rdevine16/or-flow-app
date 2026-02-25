import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Profile',
}

export default function Page() {
  return <PageClient />
}
