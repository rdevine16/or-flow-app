import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Epic Entity Mappings',
}

export default function Page() {
  return <PageClient />
}
