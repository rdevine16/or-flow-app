import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Audit Log',
}

export default function Page() {
  return <PageClient />
}
