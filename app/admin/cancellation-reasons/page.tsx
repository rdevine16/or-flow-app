import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Cancellation Reasons',
}

export default function Page() {
  return <PageClient />
}
