import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/server/db/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function isAllowedType(mimeType: string): boolean {
  if (ALLOWED_TYPES.has(mimeType)) return true;
  if (mimeType.startsWith('image/')) return true;
  return false;
}

function sanitizeFilename(filename: string): string {
  // Remove path traversal characters and special characters
  return filename
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\./, '_')
    .slice(0, 200);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isAllowedType(file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed. Accepted: images, PDF, DOC, DOCX` },
        { status: 400 }
      );
    }

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.userId !== (session.user as { id: string }).id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Sanitize and generate unique filename
    const sanitized = sanitizeFilename(file.name);
    const ext = sanitized.includes('.') ? sanitized.slice(sanitized.lastIndexOf('.')) : '';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

    // Create upload directory
    const uploadDir = join(process.cwd(), 'public', 'uploads', projectId);
    await mkdir(uploadDir, { recursive: true });

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadDir, uniqueName);
    await writeFile(filePath, buffer);

    // Create Asset record in DB
    const asset = await prisma.asset.create({
      data: {
        projectId,
        filename: sanitized,
        url: `/uploads/${projectId}/${uniqueName}`,
        mimeType: file.type,
        size: file.size,
      },
    });

    return NextResponse.json({
      url: asset.url,
      assetId: asset.id,
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: asset.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
