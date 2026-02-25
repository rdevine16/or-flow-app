import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Users',
}

export default function Page() {
  return <PageClient />
}
