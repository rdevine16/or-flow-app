import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Financial Settings',
}

export default function Page() {
  return <PageClient />
}
