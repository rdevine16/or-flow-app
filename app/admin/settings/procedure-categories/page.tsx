import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Procedure Categories',
}

export default function Page() {
  return <PageClient />
}
