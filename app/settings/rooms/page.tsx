import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Rooms',
}

export default function Page() {
  return <PageClient />
}
