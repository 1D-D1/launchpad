'use client';

import StatusBadge from '@/components/shared/status-badge';
import MetricCard from '@/components/shared/metric-card';
import ExportToolbar from '@/components/shared/export-toolbar';
import FunnelChartComponent from '@/components/charts/funnel-chart';
import LineChartComponent from '@/components/charts/line-chart';
import BarChartComponent from '@/components/charts/bar-chart';

interface EmailSequence {
  id: string;
  name: string;
  project: string;
  emails: number;
  status: 'active' | 'draft' | 'paused';
  sent: number;
  opened: number;
  replied: number;
  openRate: number;
  replyRate: number;
}

const sequences: EmailSequence[] = [
  { id: '1', name: 'Cold Outreach - SaaS Decision Makers', project: 'SaaS Growth', emails: 5, status: 'active', sent: 1240, opened: 521, replied: 105, openRate: 42, replyRate: 8.5 },
  { id: '2', name: 'Warm Lead Nurture', project: 'SaaS Growth', emails: 3, status: 'active', sent: 680, opened: 340, replied: 68, openRate: 50, replyRate: 10 },
  { id: '3', name: 'Holiday Promo Blast', project: 'E-commerce Holiday', emails: 4, status: 'paused', sent: 3200, opened: 1152, replied: 96, openRate: 36, replyRate: 3 },
  { id: '4', name: 'Re-engagement Campaign', project: 'SaaS Growth', emails: 3, status: 'draft', sent: 0, opened: 0, replied: 0, openRate: 0, replyRate: 0 },
];

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  stage: 'new' | 'contacted' | 'engaged' | 'qualified' | 'converted';
  lastActivity: string;
}

const leads: Lead[] = [
  { id: '1', name: 'Sarah Chen', email: 's.chen@techcorp.com', company: 'TechCorp', stage: 'qualified', lastActivity: '1h ago' },
  { id: '2', name: 'Mike Johnson', email: 'm.johnson@startupinc.io', company: 'StartupInc', stage: 'engaged', lastActivity: '3h ago' },
  { id: '3', name: 'Alex Rivera', email: 'a.rivera@growthco.com', company: 'GrowthCo', stage: 'contacted', lastActivity: '5h ago' },
  { id: '4', name: 'Emma Wilson', email: 'e.wilson@bigbrand.com', company: 'BigBrand', stage: 'new', lastActivity: '1d ago' },
  { id: '5', name: 'David Park', email: 'd.park@scalefirm.com', company: 'ScaleFirm', stage: 'converted', lastActivity: '2d ago' },
];

const stageColors: Record<Lead['stage'], string> = {
  new: 'bg-zinc-500',
  contacted: 'bg-blue-500',
  engaged: 'bg-amber-500',
  qualified: 'bg-indigo-500',
  converted: 'bg-emerald-500',
};

const funnelData = [
  { name: 'Sent', count: 5120, color: '#3b82f6' },
  { name: 'Opened', count: 2013, color: '#6366f1' },
  { name: 'Replied', count: 269, color: '#8b5cf6' },
  { name: 'Qualified', count: 89, color: '#a855f7' },
  { name: 'Converted', count: 23, color: '#10b981' },
];

const openRateOverTime = [
  { name: 'W1', coldOutreach: 38, warmNurture: 48, promo: 32 },
  { name: 'W2', coldOutreach: 40, warmNurture: 50, promo: 34 },
  { name: 'W3', coldOutreach: 42, warmNurture: 52, promo: 36 },
  { name: 'W4', coldOutreach: 41, warmNurture: 49, promo: 38 },
  { name: 'W5', coldOutreach: 44, warmNurture: 53, promo: 35 },
  { name: 'W6', coldOutreach: 43, warmNurture: 51, promo: 37 },
];

const replyRateBySequence = [
  { name: 'Cold Outreach', replyRate: 8.5, openRate: 42 },
  { name: 'Warm Nurture', replyRate: 10, openRate: 50 },
  { name: 'Promo Blast', replyRate: 3, openRate: 36 },
  { name: 'Re-engage', replyRate: 0, openRate: 0 },
];

export default function EmailsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Emails</h1>
          <p className="mt-1 text-sm text-zinc-400">Email sequences and lead management</p>
        </div>
        <ExportToolbar
          projectId="current"
          csvTypes={[
            { label: 'Email Campaigns', value: 'emails' },
            { label: 'Leads Export', value: 'leads' },
          ]}
        />
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Emails Sent" value="5,120" trend={{ value: 18, isPositive: true }} />
        <MetricCard label="Avg. Open Rate" value="42%" trend={{ value: 3.2, isPositive: true }} />
        <MetricCard label="Avg. Reply Rate" value="8.5%" trend={{ value: 1.1, isPositive: true }} />
        <MetricCard label="Meetings Booked" value="23" trend={{ value: 28, isPositive: true }} />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Lead Funnel</h2>
          <FunnelChartComponent data={funnelData} height={280} />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Open Rate Over Time</h2>
          <LineChartComponent
            data={openRateOverTime}
            series={[
              { dataKey: 'coldOutreach', name: 'Cold Outreach', color: '#3b82f6' },
              { dataKey: 'warmNurture', name: 'Warm Nurture', color: '#10b981' },
              { dataKey: 'promo', name: 'Promo Blast', color: '#f59e0b' },
            ]}
            height={260}
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Reply Rate by Sequence</h2>
        <BarChartComponent
          data={replyRateBySequence}
          series={[
            { dataKey: 'openRate', name: 'Open Rate %', color: '#3b82f6' },
            { dataKey: 'replyRate', name: 'Reply Rate %', color: '#10b981' },
          ]}
          height={260}
        />
      </div>

      {/* Sequences */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Email Sequences</h2>
        <div className="space-y-3">
          {sequences.map((seq) => (
            <div
              key={seq.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white">{seq.name}</h3>
                  <StatusBadge
                    label={seq.status.charAt(0).toUpperCase() + seq.status.slice(1)}
                    variant={seq.status === 'active' ? 'success' : seq.status === 'paused' ? 'warning' : 'neutral'}
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  {seq.project} &middot; {seq.emails} emails in sequence
                </p>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <p className="font-medium text-white">{seq.sent.toLocaleString()}</p>
                  <p className="text-xs text-zinc-500">Sent</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-white">{seq.openRate}%</p>
                  <p className="text-xs text-zinc-500">Opened</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-white">{seq.replyRate}%</p>
                  <p className="text-xs text-zinc-500">Replied</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lead Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Leads</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-2 text-left font-medium text-zinc-400">Name</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-400">Company</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-400">Email</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-400">Stage</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-400">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-white">{lead.name}</td>
                  <td className="px-4 py-3 text-zinc-300">{lead.company}</td>
                  <td className="px-4 py-3 text-zinc-400">{lead.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${stageColors[lead.stage]}`} />
                      <span className="text-zinc-300 capitalize">{lead.stage}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{lead.lastActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
