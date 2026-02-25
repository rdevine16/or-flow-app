import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Bulk Create Cases',
}

export default function Page() {
  return <PageClient />
}
