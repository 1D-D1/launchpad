/**
 * Pipeline status endpoint
 * GET /api/projects/[id]/pipeline
 *
 * Returns all PipelineJob records for the project with their status,
 * timing info, and stage metadata. Used by the frontend pipeline stepper.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { PIPELINE_STAGES, PIPELINE_STAGE_MAP } from '@/types/pipeline';

const log = logger.child({ route: '/api/projects/[id]/pipeline' });

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Validate user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const userId = (session.user as { id: string }).id;

    // 2. Fetch project and verify ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true, status: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Fetch all pipeline jobs for this project, ordered by creation
    const pipelineJobs = await prisma.pipelineJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Group by stage -- take the most recent job per stage
    const latestByStage = new Map<string, typeof pipelineJobs[0]>();
    for (const job of pipelineJobs) {
      if (!latestByStage.has(job.stage)) {
        latestByStage.set(job.stage, job);
      }
    }

    // 5. Build the pipeline status response, merging stage definitions with job records
    const stages = PIPELINE_STAGES.map((stageDef) => {
      const job = latestByStage.get(stageDef.key);

      let durationMs: number | null = null;
      if (job?.startedAt && job?.completedAt) {
        durationMs = new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();
      } else if (job?.startedAt) {
        durationMs = Date.now() - new Date(job.startedAt).getTime();
      }

      return {
        key: stageDef.key,
        label: stageDef.label,
        description: stageDef.description,
        order: stageDef.order,
        // Job-level fields (null if no job exists yet for this stage)
        jobId: job?.id ?? null,
        status: job?.status ?? 'PENDING',
        attempts: job?.attempts ?? 0,
        maxAttempts: job?.maxAttempts ?? 3,
        error: job?.error ?? null,
        startedAt: job?.startedAt ?? null,
        completedAt: job?.completedAt ?? null,
        durationMs,
        durationFormatted: durationMs !== null ? formatDuration(durationMs) : null,
        createdAt: job?.createdAt ?? null,
      };
    });

    // 6. Compute overall pipeline summary
    const completedCount = stages.filter((s) => s.status === 'COMPLETED').length;
    const failedCount = stages.filter((s) => s.status === 'FAILED').length;
    const runningCount = stages.filter((s) => s.status === 'RUNNING').length;
    const totalStages = stages.length;

    const currentStage = stages.find((s) => s.status === 'RUNNING') ??
      stages.find((s) => s.status === 'PENDING' && stages.some((prev) => prev.order < s.order && prev.status === 'COMPLETED'));

    let overallStatus: string;
    if (failedCount > 0) overallStatus = 'FAILED';
    else if (completedCount === totalStages) overallStatus = 'COMPLETED';
    else if (runningCount > 0) overallStatus = 'RUNNING';
    else if (completedCount > 0) overallStatus = 'IN_PROGRESS';
    else overallStatus = 'PENDING';

    return NextResponse.json({
      projectId,
      projectStatus: project.status,
      projectName: project.name,
      pipeline: {
        overallStatus,
        progress: Math.round((completedCount / totalStages) * 100),
        completedStages: completedCount,
        totalStages,
        failedStages: failedCount,
        runningStages: runningCount,
        currentStage: currentStage ? { key: currentStage.key, label: currentStage.label } : null,
      },
      stages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, 'Failed to fetch pipeline status');

    return NextResponse.json(
      { error: 'Failed to fetch pipeline status', details: message },
      { status: 500 },
    );
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
