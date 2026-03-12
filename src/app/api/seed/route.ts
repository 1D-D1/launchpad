import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  // Security: require NEXTAUTH_SECRET as bearer token
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.NEXTAUTH_SECRET;

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if users already exist
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      return NextResponse.json({
        message: 'Database already seeded',
        userCount: existingUsers
      });
    }

    // Create users
    const adminHash = await bcrypt.hash('LaunchPad2026!', 12);
    const managerHash = await bcrypt.hash('Demo2026!', 12);
    const viewerHash = await bcrypt.hash('Viewer2026!', 12);

    const admin = await prisma.user.create({
      data: {
        email: 'admin@launchpad.io',
        name: 'Alexandre Dupont',
        passwordHash: adminHash,
        role: 'ADMIN',
      },
    });

    const manager = await prisma.user.create({
      data: {
        email: 'demo@launchpad.io',
        name: 'Marie Laurent',
        passwordHash: managerHash,
        role: 'MANAGER',
      },
    });

    const viewer = await prisma.user.create({
      data: {
        email: 'viewer@launchpad.io',
        name: 'Lucas Martin',
        passwordHash: viewerHash,
        role: 'VIEWER',
      },
    });

    // Create a demo project for the manager
    const project = await prisma.project.create({
      data: {
        name: 'Startup Growth Campaign',
        description: 'AI-powered marketing campaign for a SaaS startup targeting B2B clients in the fintech vertical.',
        vertical: 'SaaS / Fintech',
        targetAudience: {
          demographics: { age: '25-45', role: 'CTO/CFO/CEO', companySize: '10-500' },
          psychographics: { painPoints: ['manual processes', 'lack of insights', 'scaling difficulties'] },
          channels: ['LinkedIn', 'Google', 'Email'],
        },
        budget: {
          total: 5000,
          currency: 'EUR',
          breakdown: { ads: 2000, content: 1500, tools: 500, email: 500, reserve: 500 },
        },
        objectives: {
          primary: 'Generate 200 qualified leads in 30 days',
          secondary: ['Increase brand awareness', 'Build email list to 1000+', 'Achieve 3% conversion rate'],
          kpis: { leads: 200, conversionRate: 0.03, cac: 25, roi: 3.0 },
        },
        competitors: [
          { name: 'CompetitorA', url: 'https://competitor-a.com', notes: 'Market leader' },
          { name: 'CompetitorB', url: 'https://competitor-b.com', notes: 'Fast growing' },
        ],
        status: 'DRAFT',
        userId: manager.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        users: [
          { email: admin.email, role: admin.role },
          { email: manager.email, role: manager.role },
          { email: viewer.email, role: viewer.role },
        ],
        projects: [{ name: project.name, status: project.status }],
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Seed failed', details: String(error) },
      { status: 500 }
    );
  }
}
