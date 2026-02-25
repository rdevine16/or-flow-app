import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Procedure Pricing',
}

export default function Page() {
  return <PageClient />
}
