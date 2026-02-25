import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function Page() {
  return <PageClient />
}
