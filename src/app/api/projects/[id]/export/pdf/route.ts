import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PdfGenerator } from '@/server/services/export/pdf-generator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  const type = req.nextUrl.searchParams.get('type') || 'project';

  try {
    let html: string;

    if (type === 'analytics') {
      html = await PdfGenerator.analyticsReport(projectId);
    } else {
      html = await PdfGenerator.projectReport(projectId);
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Report generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
