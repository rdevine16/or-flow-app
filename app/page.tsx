// This is the main entry point for the application. It redirects to the dashboard page.
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}