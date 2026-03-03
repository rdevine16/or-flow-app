import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'MEDITECH HL7v2 Integration',
}

export default function Page() {
  return <PageClient />
}
