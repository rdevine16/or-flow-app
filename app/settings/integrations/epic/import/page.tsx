import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Import Cases from Epic',
}

export default function Page() {
  return <PageClient />
}
