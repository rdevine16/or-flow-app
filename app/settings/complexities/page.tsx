import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Complexities',
}

export default function Page() {
  return <PageClient />
}
