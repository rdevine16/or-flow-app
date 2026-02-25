import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Block Schedule',
}

export default function Page() {
  return <PageClient />
}
