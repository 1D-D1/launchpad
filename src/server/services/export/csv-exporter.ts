import { prisma } from '@/server/db/prisma';

// UTF-8 BOM for Excel compatibility
const BOM = '\uFEFF';

export class CsvExporter {
  /** Build a CSV string from headers and rows */
  static toCSV(headers: string[], rows: string[][]): string {
    const escape = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const headerLine = headers.map(escape).join(',');
    const dataLines = rows.map((row) => row.map(escape).join(','));
    return BOM + [headerLine, ...dataLines].join('\n');
  }

  /** Project overview report */
  static async projectReport(projectId: string): Promise<string> {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        _count: { select: { contents: true, campaigns: true, emailSequences: true, assets: true } },
        strategies: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    const budget = project.budget as Record<string, unknown>;

    const headers = ['Field', 'Value'];
    const rows = [
      ['Project Name', project.name],
      ['Description', project.description],
      ['Vertical', project.vertical],
      ['Status', project.status],
      ['Budget Total', String(budget?.total ?? 'N/A')],
      ['Budget Currency', String(budget?.currency ?? 'N/A')],
      ['Content Pieces', String(project._count.contents)],
      ['Ad Campaigns', String(project._count.campaigns)],
      ['Email Sequences', String(project._count.emailSequences)],
      ['Assets', String(project._count.assets)],
      ['Created', project.createdAt.toISOString()],
      ['Last Updated', project.updatedAt.toISOString()],
    ];

    return CsvExporter.toCSV(headers, rows);
  }

  /** Content performance report */
  static async contentReport(projectId: string): Promise<string> {
    const contents = await prisma.content.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Title', 'Type', 'Platform', 'Status', 'Published At', 'Created At'];
    const rows = contents.map((c) => [
      c.title || 'Untitled',
      c.type,
      c.platform || 'N/A',
      c.status,
      c.publishedAt?.toISOString() || 'Not published',
      c.createdAt.toISOString(),
    ]);

    return CsvExporter.toCSV(headers, rows);
  }

  /** Ads performance report */
  static async adsReport(projectId: string): Promise<string> {
    const campaigns = await prisma.adCampaign.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Campaign Name', 'Platform', 'Objective', 'Budget', 'Budget Type', 'Status', 'Auto-Optimize', 'Created At'];
    const rows = campaigns.map((c) => [
      c.name,
      c.platform,
      c.objective,
      String(c.budget),
      c.budgetType,
      c.status,
      c.autoOptimize ? 'Yes' : 'No',
      c.createdAt.toISOString(),
    ]);

    return CsvExporter.toCSV(headers, rows);
  }

  /** Email campaign report */
  static async emailReport(projectId: string): Promise<string> {
    const sequences = await prisma.emailSequence.findMany({
      where: { projectId },
      include: {
        _count: { select: { steps: true, leads: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Sequence Name', 'Status', 'Steps', 'Leads', 'Created At'];
    const rows = sequences.map((s) => [
      s.name,
      s.status,
      String(s._count.steps),
      String(s._count.leads),
      s.createdAt.toISOString(),
    ]);

    return CsvExporter.toCSV(headers, rows);
  }

  /** Leads export */
  static async leadsExport(projectId: string): Promise<string> {
    const sequences = await prisma.emailSequence.findMany({
      where: { projectId },
      select: { id: true },
    });
    const sequenceIds = sequences.map((s) => s.id);

    const leads = await prisma.lead.findMany({
      where: { sequenceId: { in: sequenceIds } },
      include: { sequence: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Email', 'First Name', 'Last Name', 'Company', 'Job Title', 'Status', 'Email Verified', 'Sequence', 'Created At'];
    const rows = leads.map((l) => [
      l.email,
      l.firstName || '',
      l.lastName || '',
      l.company || '',
      l.jobTitle || '',
      l.status,
      l.emailVerified ? 'Yes' : 'No',
      l.sequence?.name || 'N/A',
      l.createdAt.toISOString(),
    ]);

    return CsvExporter.toCSV(headers, rows);
  }
}
