import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Block Utilization',
}

export default function Page() {
  return <PageClient />
}
