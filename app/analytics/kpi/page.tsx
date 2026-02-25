import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'KPI Dashboard',
}

export default function Page() {
  return <PageClient />
}
