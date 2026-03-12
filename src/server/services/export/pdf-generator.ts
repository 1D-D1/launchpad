import { prisma } from '@/server/db/prisma';

export class PdfGenerator {
  /** Generate an HTML project report summary (client can print to PDF) */
  static async projectReport(projectId: string): Promise<string> {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        _count: { select: { contents: true, campaigns: true, emailSequences: true } },
        strategies: { take: 1, orderBy: { createdAt: 'desc' } },
        campaigns: { take: 5, orderBy: { createdAt: 'desc' } },
        emailSequences: {
          take: 5,
          include: { _count: { select: { leads: true, steps: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const budget = project.budget as Record<string, unknown>;
    const objectives = project.objectives as Record<string, unknown>;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(project.name)} - Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #09090b; color: #e4e4e7; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { color: #fff; font-size: 28px; margin-bottom: 8px; }
    h2 { color: #fff; font-size: 20px; margin: 32px 0 16px; border-bottom: 1px solid #333; padding-bottom: 8px; }
    h3 { color: #a1a1aa; font-size: 14px; font-weight: 500; margin-bottom: 4px; }
    .subtitle { color: #71717a; font-size: 14px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; }
    .card .value { font-size: 24px; font-weight: 600; color: #fff; margin-top: 4px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .table th, .table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #27272a; font-size: 13px; }
    .table th { color: #71717a; font-weight: 500; }
    .table td { color: #d4d4d8; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
    .badge-active { background: #064e3b; color: #34d399; }
    .badge-draft { background: #27272a; color: #a1a1aa; }
    .section-note { color: #71717a; font-size: 13px; margin-top: 8px; font-style: italic; }
    @media print { body { background: #fff; color: #333; } .card { border-color: #ddd; background: #f9f9f9; } .card .value { color: #111; } h1, h2 { color: #111; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(project.name)}</h1>
  <p class="subtitle">Project Report &middot; Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

  <h2>Overview</h2>
  <div class="grid">
    <div class="card">
      <h3>Status</h3>
      <div class="value">${project.status.replace(/_/g, ' ')}</div>
    </div>
    <div class="card">
      <h3>Vertical</h3>
      <div class="value">${escapeHtml(project.vertical)}</div>
    </div>
    <div class="card">
      <h3>Budget</h3>
      <div class="value">${budget?.currency || '$'}${Number(budget?.total || 0).toLocaleString()}</div>
    </div>
    <div class="card">
      <h3>Primary Objective</h3>
      <div class="value" style="font-size:16px;">${escapeHtml(String(objectives?.primary || 'N/A'))}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>Content Pieces</h3>
      <div class="value">${project._count.contents}</div>
    </div>
    <div class="card">
      <h3>Ad Campaigns</h3>
      <div class="value">${project._count.campaigns}</div>
    </div>
    <div class="card">
      <h3>Email Sequences</h3>
      <div class="value">${project._count.emailSequences}</div>
    </div>
  </div>

  <h2>Description</h2>
  <p style="color:#a1a1aa;line-height:1.6;">${escapeHtml(project.description)}</p>

  ${project.campaigns.length > 0 ? `
  <h2>Recent Ad Campaigns</h2>
  <table class="table">
    <thead><tr><th>Name</th><th>Platform</th><th>Budget</th><th>Status</th></tr></thead>
    <tbody>
      ${project.campaigns.map((c) => `<tr><td>${escapeHtml(c.name)}</td><td>${c.platform}</td><td>$${c.budget.toLocaleString()}</td><td><span class="badge ${c.status === 'ACTIVE' ? 'badge-active' : 'badge-draft'}">${c.status}</span></td></tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${project.emailSequences.length > 0 ? `
  <h2>Email Sequences</h2>
  <table class="table">
    <thead><tr><th>Name</th><th>Steps</th><th>Leads</th><th>Status</th></tr></thead>
    <tbody>
      ${project.emailSequences.map((s) => `<tr><td>${escapeHtml(s.name)}</td><td>${s._count.steps}</td><td>${s._count.leads}</td><td><span class="badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-draft'}">${s.status}</span></td></tr>`).join('')}
    </tbody>
  </table>` : ''}

  <p class="section-note" style="margin-top:40px;">This report was auto-generated by Launchpad. Use Ctrl+P / Cmd+P to save as PDF.</p>
</body>
</html>`;
  }

  /** Generate an analytics-focused HTML report */
  static async analyticsReport(projectId: string): Promise<string> {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        contents: { where: { status: 'PUBLISHED' }, select: { type: true, platform: true, metrics: true, publishedAt: true } },
        campaigns: { select: { name: true, platform: true, budget: true, metrics: true, status: true } },
        emailSequences: { include: { _count: { select: { leads: true } }, leads: { select: { status: true } } } },
      },
    });

    const totalLeads = project.emailSequences.reduce((acc, s) => acc + s._count.leads, 0);
    const totalAdBudget = project.campaigns.reduce((acc, c) => acc + c.budget, 0);
    const publishedContent = project.contents.length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(project.name)} - Analytics Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #09090b; color: #e4e4e7; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { color: #fff; font-size: 28px; margin-bottom: 8px; }
    h2 { color: #fff; font-size: 20px; margin: 32px 0 16px; border-bottom: 1px solid #333; padding-bottom: 8px; }
    h3 { color: #a1a1aa; font-size: 14px; font-weight: 500; margin-bottom: 4px; }
    .subtitle { color: #71717a; font-size: 14px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; }
    .card .value { font-size: 24px; font-weight: 600; color: #fff; margin-top: 4px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .table th, .table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #27272a; font-size: 13px; }
    .table th { color: #71717a; font-weight: 500; }
    .table td { color: #d4d4d8; }
    .section-note { color: #71717a; font-size: 13px; margin-top: 8px; font-style: italic; }
    @media print { body { background: #fff; color: #333; } .card { border-color: #ddd; background: #f9f9f9; } .card .value { color: #111; } h1, h2 { color: #111; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(project.name)} - Analytics</h1>
  <p class="subtitle">Analytics Report &middot; Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

  <h2>Key Metrics</h2>
  <div class="grid">
    <div class="card"><h3>Published Content</h3><div class="value">${publishedContent}</div></div>
    <div class="card"><h3>Total Ad Budget</h3><div class="value">$${totalAdBudget.toLocaleString()}</div></div>
    <div class="card"><h3>Total Leads</h3><div class="value">${totalLeads}</div></div>
    <div class="card"><h3>Active Campaigns</h3><div class="value">${project.campaigns.filter((c) => c.status === 'ACTIVE').length}</div></div>
  </div>

  ${project.campaigns.length > 0 ? `
  <h2>Campaign Performance</h2>
  <table class="table">
    <thead><tr><th>Campaign</th><th>Platform</th><th>Budget</th><th>Status</th></tr></thead>
    <tbody>
      ${project.campaigns.map((c) => `<tr><td>${escapeHtml(c.name)}</td><td>${c.platform}</td><td>$${c.budget.toLocaleString()}</td><td>${c.status}</td></tr>`).join('')}
    </tbody>
  </table>` : ''}

  <h2>Recommendations</h2>
  <ul style="color:#a1a1aa;line-height:1.8;padding-left:20px;">
    ${totalAdBudget === 0 ? '<li>Consider allocating budget to paid advertising to accelerate growth.</li>' : ''}
    ${publishedContent < 5 ? '<li>Increase content production to improve organic reach.</li>' : ''}
    ${totalLeads === 0 ? '<li>Set up email sequences and lead capture to build your pipeline.</li>' : ''}
    <li>Review campaign metrics weekly and reallocate budget toward top-performing channels.</li>
    <li>A/B test content variants to optimize engagement rates.</li>
  </ul>

  <p class="section-note" style="margin-top:40px;">Use Ctrl+P / Cmd+P to save as PDF.</p>
</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
