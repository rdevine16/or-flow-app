import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Flag Settings',
}

export default function Page() {
  return <PageClient />
}
