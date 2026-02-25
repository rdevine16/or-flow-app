import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Procedures',
}

export default function Page() {
  return <PageClient />
}
