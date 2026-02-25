import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Global Security',
}

export default function Page() {
  return <PageClient />
}
