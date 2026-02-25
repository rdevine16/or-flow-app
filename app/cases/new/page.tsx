import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'New Case',
}

export default function Page() {
  return <PageClient />
}
