import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Accept Invitation',
}

export default function Page() {
  return <PageClient />
}
