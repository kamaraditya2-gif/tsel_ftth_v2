import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const query = `DELETE FROM queue_jobs WHERE id = $1`
    const result = await pool.query(query, [id])

    return NextResponse.json(
      { message: 'Queue job deleted successfully', deletedCount: result.rowCount },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting queue job:', error)
    return NextResponse.json(
      { error: 'Failed to delete queue job' },
      { status: 500 }
    )
  }
}
