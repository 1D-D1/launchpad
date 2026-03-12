import { NextRequest, NextResponse } from 'next/server';
import { AdsExporter } from '@/server/services/ads/export';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';

const log = logger.child({ route: 'export/google-ads' });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const exporter = new AdsExporter();
    const csv = await exporter.exportGoogleAdsCSV(projectId);

    const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${safeName}-google-ads-${dateStr}.csv`;

    log.info({ projectId, filename }, 'Google Ads CSV exported');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    log.error({ err, projectId }, 'Failed to export Google Ads CSV');
    return NextResponse.json(
      { error: 'Failed to generate Google Ads CSV export' },
      { status: 500 },
    );
  }
}
