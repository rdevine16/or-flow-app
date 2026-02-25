import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Body Regions',
}

export default function Page() {
  return <PageClient />
}
