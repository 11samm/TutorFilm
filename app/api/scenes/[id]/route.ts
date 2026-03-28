import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing scene id' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: row, error: fetchErr } = await supabase
    .from('scenes')
    .select('id, project_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) {
    console.error('DELETE /api/scenes/[id] select', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
  }

  const projectId = row.project_id as string

  const { error: delErr } = await supabase.from('scenes').delete().eq('id', id)
  if (delErr) {
    console.error('DELETE /api/scenes/[id] delete', delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  const { data: remaining, error: listErr } = await supabase
    .from('scenes')
    .select('id, order')
    .eq('project_id', projectId)
    .order('order', { ascending: true })

  if (listErr) {
    console.error('DELETE /api/scenes/[id] list', listErr)
    return NextResponse.json({ error: listErr.message }, { status: 500 })
  }

  const rows = (remaining ?? []) as { id: string; order: number }[]
  for (let i = 0; i < rows.length; i++) {
    const nextOrder = i + 1
    if (rows[i].order === nextOrder) continue
    const { error: upErr } = await supabase
      .from('scenes')
      .update({ order: nextOrder })
      .eq('id', rows[i].id)
    if (upErr) {
      console.error('DELETE /api/scenes/[id] renumber', upErr)
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
