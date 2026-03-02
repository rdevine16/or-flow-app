import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'HL7v2 Test Harness',
}

export default function Page() {
  return <PageClient />
}
