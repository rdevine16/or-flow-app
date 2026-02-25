import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Flag Rules',
}

export default function Page() {
  return <PageClient />
}
