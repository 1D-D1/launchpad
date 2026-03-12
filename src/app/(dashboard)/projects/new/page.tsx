'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import type { Vertical } from '@/types/project';
import { trpc } from '@/lib/trpc';

const VERTICALS: { value: Vertical; label: string }[] = [
  { value: 'ECOMMERCE', label: 'E-commerce' },
  { value: 'SAAS', label: 'SaaS' },
  { value: 'AGENCY', label: 'Agency' },
  { value: 'CONSULTING', label: 'Consulting' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'FOOD', label: 'Food & Beverage' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'OTHER', label: 'Other' },
];

const STEP_LABELS = [
  'Basic Info',
  'Target Audience',
  'Budget & Objectives',
  'Competitors',
  'Review & Submit',
];

interface FormState {
  // Step 1
  name: string;
  description: string;
  vertical: string;
  // Step 2
  demographics: string;
  interests: string;
  location: string;
  ageRange: string;
  // Step 3
  budgetTotal: string;
  currency: string;
  primaryObjective: string;
  secondaryObjectives: string;
  kpis: string;
  // Step 4
  competitors: { name: string; url: string }[];
}

const initialForm: FormState = {
  name: '',
  description: '',
  vertical: '',
  demographics: '',
  interests: '',
  location: '',
  ageRange: '',
  budgetTotal: '',
  currency: 'USD',
  primaryObjective: '',
  secondaryObjectives: '',
  kpis: '',
  competitors: [{ name: '', url: '' }],
};

function buildMutationInput(form: FormState) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    vertical: form.vertical,
    targetAudience: {
      demographics: form.demographics.trim() || undefined,
      interests: form.interests
        ? form.interests.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      location: form.location.trim() || undefined,
      ageRange: form.ageRange.trim() || undefined,
    },
    budget: {
      total: parseFloat(form.budgetTotal) || 0,
      currency: form.currency,
    },
    objectives: {
      primary: form.primaryObjective.trim(),
      secondary: form.secondaryObjectives
        ? form.secondaryObjectives.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      kpis: form.kpis
        ? form.kpis.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    },
    competitors: form.competitors
      .filter((c) => c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        url: c.url.trim() || undefined,
      })),
  };
}

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const createMutation = (trpc.project.create as any).useMutation({
    onSuccess: () => {
      setToast({ type: 'success', message: 'Draft saved successfully!' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (err: any) => {
      setToast({ type: 'error', message: err.message || 'Failed to save draft.' });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const submitMutation = (trpc.project.create as any).useMutation({
    onSuccess: (data: any) => {
      // After creating, submit the project
      submitProjectMutation.mutate({ id: data.id });
    },
    onError: (err: any) => {
      setToast({ type: 'error', message: err.message || 'Failed to create project.' });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const submitProjectMutation = (trpc.project.submit as any).useMutation({
    onSuccess: (data: any) => {
      setToast({ type: 'success', message: 'Project submitted! AI processing will begin shortly.' });
      setTimeout(() => {
        router.push(`/projects/${data.id}`);
      }, 1000);
    },
    onError: (err: any) => {
      setToast({ type: 'error', message: err.message || 'Failed to submit project.' });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const saving = createMutation.isPending || submitMutation.isPending || submitProjectMutation.isPending;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addCompetitor() {
    setForm((prev) => ({
      ...prev,
      competitors: [...prev.competitors, { name: '', url: '' }],
    }));
  }

  function updateCompetitor(index: number, field: 'name' | 'url', value: string) {
    setForm((prev) => {
      const updated = [...prev.competitors];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, competitors: updated };
    });
  }

  function removeCompetitor(index: number) {
    setForm((prev) => ({
      ...prev,
      competitors: prev.competitors.filter((_, i) => i !== index),
    }));
  }

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return !!form.name.trim() && !!form.description.trim() && !!form.vertical;
      case 1:
        return !!form.demographics.trim() && !!form.location.trim();
      case 2:
        return !!form.budgetTotal && !!form.primaryObjective.trim();
      case 3:
        return form.competitors.some((c) => c.name.trim());
      case 4:
        return true;
      default:
        return false;
    }
  }

  function handleSaveDraft() {
    createMutation.mutate(buildMutationInput(form));
  }

  function handleSubmit() {
    submitMutation.mutate(buildMutationInput(form));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Toast notification */}
      {toast && (
        <div
          className={clsx(
            'fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg border',
            toast.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          )}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">New Project</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Step {step + 1} of {STEP_LABELS.length}
          </p>
        </div>
        <button
          onClick={handleSaveDraft}
          disabled={saving || !form.name.trim() || !form.description.trim() || !form.vertical}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending ? 'Saving...' : 'Save Draft'}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between">
          {STEP_LABELS.map((label, index) => (
            <button
              key={label}
              onClick={() => index < step && setStep(index)}
              className={clsx(
                'text-xs font-medium transition-colors',
                index === step
                  ? 'text-blue-400'
                  : index < step
                  ? 'text-emerald-400 cursor-pointer hover:text-emerald-300'
                  : 'text-zinc-600'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {STEP_LABELS.map((_, index) => (
            <div
              key={index}
              className={clsx(
                'h-1 flex-1 rounded-full transition-colors',
                index < step
                  ? 'bg-emerald-500'
                  : index === step
                  ? 'bg-blue-500'
                  : 'bg-zinc-800'
              )}
            />
          ))}
        </div>
      </div>

      {/* Form Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8">
        {/* Step 1: Basic Info */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white">Basic Information</h2>
            <div>
              <label className="block text-sm font-medium text-zinc-300">Project Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="My Awesome Campaign"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                placeholder="Describe your product or service and what you want to achieve..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">Vertical</label>
              <select
                value={form.vertical}
                onChange={(e) => updateField('vertical', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select a vertical</option>
                {VERTICALS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Target Audience */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white">Target Audience</h2>
            <div>
              <label className="block text-sm font-medium text-zinc-300">Demographics</label>
              <textarea
                value={form.demographics}
                onChange={(e) => updateField('demographics', e.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                placeholder="e.g., Small business owners, tech-savvy professionals..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">Interests</label>
              <input
                type="text"
                value={form.interests}
                onChange={(e) => updateField('interests', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Comma-separated: marketing, growth, automation..."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-300">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., United States, Europe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300">Age Range</label>
                <input
                  type="text"
                  value={form.ageRange}
                  onChange={(e) => updateField('ageRange', e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., 25-45"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Budget & Objectives */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white">Budget & Objectives</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-300">Total Budget</label>
                <div className="relative mt-1.5">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">$</span>
                  <input
                    type="number"
                    value={form.budgetTotal}
                    onChange={(e) => updateField('budgetTotal', e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-8 pr-4 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="5000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">Primary Objective</label>
              <input
                type="text"
                value={form.primaryObjective}
                onChange={(e) => updateField('primaryObjective', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., Generate 100 qualified leads per month"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">Secondary Objectives</label>
              <input
                type="text"
                value={form.secondaryObjectives}
                onChange={(e) => updateField('secondaryObjectives', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Comma-separated: brand awareness, social following, email list..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">KPIs to Track</label>
              <input
                type="text"
                value={form.kpis}
                onChange={(e) => updateField('kpis', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Comma-separated: CTR, CPA, ROAS, open rate..."
              />
            </div>
          </div>
        )}

        {/* Step 4: Competitors */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white">Competitors</h2>
            <p className="text-sm text-zinc-400">
              Add your main competitors so AI can analyze their positioning and find opportunities.
            </p>
            <div className="space-y-3">
              {form.competitors.map((comp, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={comp.name}
                      onChange={(e) => updateCompetitor(index, 'name', e.target.value)}
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Competitor name"
                    />
                    <input
                      type="url"
                      value={comp.url}
                      onChange={(e) => updateCompetitor(index, 'url', e.target.value)}
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="https://competitor.com"
                    />
                  </div>
                  {form.competitors.length > 1 && (
                    <button
                      onClick={() => removeCompetitor(index)}
                      className="mt-1 rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addCompetitor}
              className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Competitor
            </button>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Review & Submit</h2>
            <p className="text-sm text-zinc-400">
              Review your project details before submitting. AI will begin processing immediately.
            </p>

            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
                <h3 className="text-sm font-medium text-zinc-400">Basic Info</h3>
                <p className="mt-1 text-white">{form.name || '-'}</p>
                <p className="mt-0.5 text-sm text-zinc-400">{form.description || '-'}</p>
                <p className="mt-0.5 text-sm text-zinc-500">Vertical: {form.vertical || '-'}</p>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
                <h3 className="text-sm font-medium text-zinc-400">Target Audience</h3>
                <p className="mt-1 text-sm text-zinc-300">
                  {form.demographics || '-'} &middot; {form.location || '-'} &middot; Age: {form.ageRange || '-'}
                </p>
                <p className="mt-0.5 text-sm text-zinc-500">Interests: {form.interests || '-'}</p>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
                <h3 className="text-sm font-medium text-zinc-400">Budget & Objectives</h3>
                <p className="mt-1 text-sm text-zinc-300">
                  ${form.budgetTotal || '0'} {form.currency}
                </p>
                <p className="mt-0.5 text-sm text-zinc-500">Goal: {form.primaryObjective || '-'}</p>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
                <h3 className="text-sm font-medium text-zinc-400">Competitors</h3>
                <div className="mt-1 space-y-1">
                  {form.competitors
                    .filter((c) => c.name.trim())
                    .map((c, i) => (
                      <p key={i} className="text-sm text-zinc-300">
                        {c.name}
                        {c.url && (
                          <span className="ml-2 text-zinc-500">({c.url})</span>
                        )}
                      </p>
                    ))}
                  {!form.competitors.some((c) => c.name.trim()) && (
                    <p className="text-sm text-zinc-500">No competitors added</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step > 0 && setStep(step - 1)}
          disabled={step === 0}
          className="rounded-lg border border-zinc-700 px-6 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>
        {step < STEP_LABELS.length - 1 ? (
          <button
            onClick={() => canProceed() && setStep(step + 1)}
            disabled={!canProceed()}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Submitting...' : 'Submit Project'}
          </button>
        )}
      </div>
    </div>
  );
}
