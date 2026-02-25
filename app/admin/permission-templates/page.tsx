import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Permission Templates',
}

export default function Page() {
  return <PageClient />
}
