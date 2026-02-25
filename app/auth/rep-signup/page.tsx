import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Representative Sign Up',
}

export default function Page() {
  return <PageClient />
}
