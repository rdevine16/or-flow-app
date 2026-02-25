import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Cost Categories',
}

export default function Page() {
  return <PageClient />
}
