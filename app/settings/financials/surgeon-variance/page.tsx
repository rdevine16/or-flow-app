import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Surgeon Variance',
}

export default function Page() {
  return <PageClient />
}
