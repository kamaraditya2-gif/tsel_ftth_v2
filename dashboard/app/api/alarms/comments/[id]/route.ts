import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const commentId = parseInt(params.id)
  if (isNaN(commentId)) {
    return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 })
  }

  try {
    const client = await pool.connect()
    const result = await client.query(
      'DELETE FROM alarm_comments WHERE id = $1 RETURNING id',
      [commentId]
    )
    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Comment deleted' })
  } catch (error: any) {
    console.error('Comment DELETE error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete comment' }, { status: 500 })
  }
}
