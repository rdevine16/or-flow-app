import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Invitation Accepted',
}

export default function Page() {
  return <PageClient />
}
