import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Implant Companies',
}

export default function Page() {
  return <PageClient />
}
