import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Cancel Case',
}

export default function Page() {
  return <PageClient />
}
