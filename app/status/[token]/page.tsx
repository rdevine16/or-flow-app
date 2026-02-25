import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Case Status',
}

export default function Page() {
  return <PageClient />
}
