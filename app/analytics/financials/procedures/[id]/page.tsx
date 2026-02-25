import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Procedure Financials',
}

export default function Page() {
  return <PageClient />
}
