import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Change Password',
}

export default function Page() {
  return <PageClient />
}
