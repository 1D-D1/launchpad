import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CsvExporter } from '@/server/services/export/csv-exporter';

type ExportType = 'project' | 'content' | 'ads' | 'emails' | 'leads';

const exporters: Record<ExportType, (projectId: string) => Promise<string>> = {
  project: CsvExporter.projectReport,
  content: CsvExporter.contentReport,
  ads: CsvExporter.adsReport,
  emails: CsvExporter.emailReport,
  leads: CsvExporter.leadsExport,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  const type = req.nextUrl.searchParams.get('type') as ExportType | null;

  if (!type || !exporters[type]) {
    return NextResponse.json(
      { error: 'Invalid export type. Must be one of: project, content, ads, emails, leads' },
      { status: 400 }
    );
  }

  try {
    const csv = await exporters[type](projectId);
    const filename = `${type}-report-${projectId}-${Date.now()}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
