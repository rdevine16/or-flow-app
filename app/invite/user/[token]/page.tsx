import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'User Invitation',
}

export default function Page() {
  return <PageClient />
}
