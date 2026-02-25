import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Milestones',
}

export default function Page() {
  return <PageClient />
}
