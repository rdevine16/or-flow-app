import { supabase } from '../lib/supabase'

export default async function Home() {
  const { data, error } = await supabase.from('test').select('*')
  
  return (
    <main style={{ padding: '2rem' }}>
      <h1>OR Flow App</h1>
      <p>Supabase connection status:</p>
      <pre>
        {error ? `Connected! (No 'test' table exists, but connection works)` : JSON.stringify(data, null, 2)}
      </pre>
    </main>
  )
}