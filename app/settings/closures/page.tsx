import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Closures',
}

export default function Page() {
  return <PageClient />
}
