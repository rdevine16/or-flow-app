import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Delay Types',
}

export default function Page() {
  return <PageClient />
}
