import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Configuration - Admin | ORbit',
}

export default function AdminConfigurationPage() {
  return <PageClient />
}
