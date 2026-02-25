import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Facilities',
}

export default function Page() {
  return <PageClient />
}
