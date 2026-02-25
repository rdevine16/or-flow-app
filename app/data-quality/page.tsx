import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Data Quality',
}

export default function Page() {
  return <PageClient />
}
