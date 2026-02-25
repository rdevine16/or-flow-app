import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'SPD Tracking',
}

export default function Page() {
  return <PageClient />
}
