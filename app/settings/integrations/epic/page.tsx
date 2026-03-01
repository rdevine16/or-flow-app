import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Epic Integration',
}

export default function Page() {
  return <PageClient />
}
