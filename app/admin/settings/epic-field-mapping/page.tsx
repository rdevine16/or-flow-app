import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Epic Field Mapping',
}

export default function Page() {
  return <PageClient />
}
