import { supabase } from '../lib/supabase'

export default async function Home() {
  // Get today's cases with related data
  const { data: cases, error } = await supabase
    .from('cases')
    .select(`
      id,
      case_number,
      scheduled_date,
      or_rooms (name),
      procedure_types (name),
      case_statuses (name)
    `)
    .eq('facility_id', 'a1111111-1111-1111-1111-111111111111')
    .order('case_number')

  if (error) {
    return <div>Error loading cases: {error.message}</div>
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>OR Flow - Memorial General Hospital</h1>
      <h2 style={{ marginBottom: '1rem', color: '#666' }}>Today's Cases</h2>
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        {cases?.map((c) => (
          <div 
            key={c.id} 
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '1rem',
              backgroundColor: '#f9f9f9'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <strong>{c.case_number}</strong>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.875rem',
                backgroundColor: 
                  c.case_statuses?.name === 'completed' ? '#d1fae5' :
                  c.case_statuses?.name === 'in_progress' ? '#fef3c7' :
                  '#e0e7ff',
                color:
                  c.case_statuses?.name === 'completed' ? '#065f46' :
                  c.case_statuses?.name === 'in_progress' ? '#92400e' :
                  '#3730a3'
              }}>
                {c.case_statuses?.name?.replace('_', ' ')}
              </span>
            </div>
            <div style={{ color: '#666' }}>
              <div>{c.or_rooms?.name} • {c.procedure_types?.name}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}