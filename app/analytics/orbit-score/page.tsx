import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'ORbit Score',
}

export default function Page() {
  return <PageClient />
}
