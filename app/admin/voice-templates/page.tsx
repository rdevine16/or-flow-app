import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Voice Templates - Admin | ORbit',
}

export default function Page() {
  return <PageClient />
}
