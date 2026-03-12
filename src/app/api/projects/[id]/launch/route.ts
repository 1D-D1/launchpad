/**
 * Pipeline launch endpoint
 * POST /api/projects/[id]/launch
 *
 * Validates user session, updates project status to SUBMITTED,
 * creates PipelineJob records for all stages, and enqueues the pipeline orchestrator.
 * This is what the "Launch Project" button calls.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { getQueue, QUEUE_PIPELINE_ORCHESTRATOR } from '@/server/jobs/queue';
import { PIPELINE_STAGES, type PipelineStageKey } from '@/types/pipeline';

const log = logger.child({ route: '/api/projects/[id]/launch' });

export async function POST(
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
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow launching from DRAFT or PAUSED states
    if (!['DRAFT', 'PAUSED', 'COMPLETED'].includes(project.status)) {
      return NextResponse.json(
        {
          error: `Project is currently in "${project.status}" status. Can only launch from DRAFT, PAUSED, or COMPLETED.`,
        },
        { status: 400 },
      );
    }

    log.info({ projectId, userId }, 'Launching project pipeline');

    // 3. Update project status to SUBMITTED
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'SUBMITTED' },
    });

    // 4. Create PipelineJob records for all stages (all PENDING)
    const pipelineJobs = [];
    for (const stage of PIPELINE_STAGES) {
      const pipelineJob = await prisma.pipelineJob.create({
        data: {
          projectId,
          stage: stage.key,
          status: 'PENDING',
        },
      });
      pipelineJobs.push({
        id: pipelineJob.id,
        stage: stage.key,
        label: stage.label,
        description: stage.description,
        order: stage.order,
        status: 'PENDING',
      });
    }

    // 5. Enqueue the pipeline-orchestrator job
    const queue = getQueue(QUEUE_PIPELINE_ORCHESTRATOR);
    const bullJob = await queue.add('pipeline-orchestrator', {
      projectId,
    });

    log.info(
      { projectId, bullJobId: bullJob.id, stageCount: pipelineJobs.length },
      'Pipeline orchestrator enqueued',
    );

    // 6. Return success with pipeline status
    return NextResponse.json({
      success: true,
      projectId,
      status: 'SUBMITTED',
      bullJobId: bullJob.id,
      pipeline: pipelineJobs,
      message: `Pipeline launched with ${pipelineJobs.length} stages`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, 'Failed to launch pipeline');

    return NextResponse.json(
      { error: 'Failed to launch pipeline', details: message },
      { status: 500 },
    );
  }
}
