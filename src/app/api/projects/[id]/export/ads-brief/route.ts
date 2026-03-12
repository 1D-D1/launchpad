import { NextRequest, NextResponse } from 'next/server';
import { AdsExporter } from '@/server/services/ads/export';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';

const log = logger.child({ route: 'export/ads-brief' });

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
    const brief = await exporter.generateAdsBrief(projectId);

    log.info({ projectId }, 'Ads brief generated');

    return NextResponse.json(brief, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}-ads-brief.json"`,
      },
    });
  } catch (err) {
    log.error({ err, projectId }, 'Failed to generate ads brief');
    return NextResponse.json(
      { error: 'Failed to generate ads brief' },
      { status: 500 },
    );
  }
}
