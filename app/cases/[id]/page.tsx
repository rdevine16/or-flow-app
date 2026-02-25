import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Case Detail',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PageClient params={params} />
}
