import { NextResponse } from 'next/server';
import { getAssumptions, updateAssumptions, resetAssumptions } from '@/data/store';

export async function GET() {
  return NextResponse.json(getAssumptions());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = updateAssumptions(body);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function DELETE() {
  const reset = resetAssumptions();
  return NextResponse.json(reset);
}
