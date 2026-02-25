import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Checklist Builder',
}

export default function Page() {
  return <PageClient />
}
