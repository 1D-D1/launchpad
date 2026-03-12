import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ---------------------------------------------------------------------------
  // Clean existing data (order matters for FK constraints)
  // ---------------------------------------------------------------------------
  await prisma.leadEvent.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.emailStep.deleteMany();
  await prisma.emailSequence.deleteMany();
  await prisma.adCampaign.deleteMany();
  await prisma.content.deleteMany();
  await prisma.strategy.deleteMany();
  await prisma.competitiveAnalysis.deleteMany();
  await prisma.pipelineJob.deleteMany();
  await prisma.stripeProject.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data.');

  // ---------------------------------------------------------------------------
  // 1. Users
  // ---------------------------------------------------------------------------
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
      name: 'Marie Lefèvre',
      passwordHash: managerHash,
      role: 'MANAGER',
    },
  });

  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@launchpad.io',
      name: 'Thomas Bernard',
      passwordHash: viewerHash,
      role: 'VIEWER',
    },
  });

  console.log('Created 3 users.');

  // ---------------------------------------------------------------------------
  // 2. Projects
  // ---------------------------------------------------------------------------
  const project1 = await prisma.project.create({
    data: {
      name: 'FitnessPro App',
      description:
        "Application SaaS de coaching fitness personnalisé avec IA. Plans d'entraînement adaptatifs, suivi nutrition et communauté intégrée. Objectif : 10 000 utilisateurs actifs en 6 mois.",
      vertical: 'tech',
      targetAudience: {
        primary: 'Jeunes actifs 25-40 ans, urbains, soucieux de leur forme physique',
        secondary: 'Sportifs amateurs cherchant à structurer leur entraînement',
        painPoints: [
          'Manque de temps pour aller en salle',
          'Programmes génériques qui ne tiennent pas compte du niveau',
          'Difficulté à rester motivé seul',
        ],
        demographics: { ageRange: '25-40', gender: 'mixed', income: '30k-60k', location: 'France métropolitaine' },
      },
      budget: { monthly: 5000, currency: 'EUR', allocation: { ads: 60, content: 25, tools: 15 } },
      objectives: {
        primary: 'Acquisition utilisateurs',
        kpis: [
          { name: 'Signups', target: 10000, timeframe: '6 mois' },
          { name: 'CAC', target: 8, unit: 'EUR' },
          { name: 'Retention M1', target: 45, unit: '%' },
        ],
      },
      competitors: ['MyFitnessPal', 'Freeletics', 'Nike Training Club'],
      status: 'ACTIVE',
      userId: manager.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'GreenBuild Guyane',
      description:
        "Entreprise d'éco-construction spécialisée dans les matériaux biosourcés adaptés au climat tropical. Offre B2B pour promoteurs et collectivités en Guyane française.",
      vertical: 'immobilier',
      targetAudience: {
        primary: 'Promoteurs immobiliers et collectivités territoriales de Guyane',
        secondary: 'Architectes et bureaux d\'études spécialisés en construction durable',
        painPoints: [
          'Normes RE2020 difficiles à appliquer en climat équatorial',
          'Peu de fournisseurs locaux de matériaux biosourcés',
          'Surcoûts logistiques liés à l\'importation',
        ],
        demographics: { sector: 'B2B', region: 'Guyane française', companySize: '10-250 employés' },
      },
      budget: { monthly: 3000, currency: 'EUR', allocation: { ads: 30, content: 40, networking: 30 } },
      objectives: {
        primary: 'Génération de leads B2B',
        kpis: [
          { name: 'Leads qualifiés', target: 50, timeframe: '3 mois' },
          { name: 'Taux de conversion', target: 12, unit: '%' },
          { name: 'Panier moyen', target: 85000, unit: 'EUR' },
        ],
      },
      competitors: ['EcoBat Tropiques', 'Guyane Construction Verte'],
      status: 'ANALYZING',
      userId: manager.id,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name: 'ChefBox',
      description:
        'Service de livraison de meal kits haut de gamme, recettes de chefs étoilés adaptées à la cuisine maison. Abonnement hebdomadaire avec options végétariennes et sans gluten.',
      vertical: 'food',
      targetAudience: {
        primary: 'Couples et familles CSP+ en zones urbaines, 30-55 ans',
        secondary: 'Foodies et passionnés de cuisine cherchant de nouvelles expériences',
        painPoints: [
          'Manque d\'inspiration pour les repas quotidiens',
          'Temps limité pour les courses et la préparation',
          'Envie de qualité restaurant à la maison',
        ],
        demographics: { ageRange: '30-55', income: '50k+', location: 'Paris, Lyon, Bordeaux, Marseille' },
      },
      budget: { monthly: 8000, currency: 'EUR', allocation: { ads: 50, content: 30, influencers: 20 } },
      objectives: {
        primary: 'Abonnements récurrents',
        kpis: [
          { name: 'Abonnés actifs', target: 2000, timeframe: '6 mois' },
          { name: 'LTV', target: 480, unit: 'EUR' },
          { name: 'Churn mensuel', target: 8, unit: '%' },
        ],
      },
      status: 'DRAFT',
      userId: admin.id,
    },
  });

  console.log('Created 3 projects.');

  // ---------------------------------------------------------------------------
  // 3. Competitive analyses for FitnessPro
  // ---------------------------------------------------------------------------
  const competitors = [
    {
      competitorName: 'MyFitnessPal',
      competitorUrl: 'https://www.myfitnesspal.com',
      score: 78,
      serpData: {
        organicKeywords: 14200,
        estimatedTraffic: 2800000,
        topKeywords: ['calorie counter', 'nutrition tracker', 'weight loss app'],
        domainAuthority: 82,
        backlinks: 450000,
      },
      socialData: {
        instagram: { followers: 1200000, avgEngagement: 1.8, postsPerWeek: 7 },
        facebook: { followers: 3400000, avgEngagement: 0.6, postsPerWeek: 5 },
        tiktok: { followers: 280000, avgEngagement: 4.2, postsPerWeek: 4 },
      },
      strengths: [
        'Base de données alimentaire massive (14M+ aliments)',
        'Intégrations avec 100+ appareils fitness',
        'Communauté très active et engagée',
        'Freemium model éprouvé avec forte conversion',
      ],
      weaknesses: [
        'Interface vieillissante, UX complexe pour les débutants',
        'Coaching IA limité, surtout plans génériques',
        'Pas de contenu vidéo natif pour les exercices',
        'Support client lent et impersonnel',
      ],
      fullReport: `# Analyse Concurrentielle - MyFitnessPal

## Vue d'ensemble
MyFitnessPal est le leader incontesté du suivi nutritionnel avec plus de 200 millions d'utilisateurs. Acquis par Francisco Partners en 2020 après avoir appartenu à Under Armour, l'application reste la référence pour le calorie counting.

## Points forts
- **Base de données nutritionnelle** : La plus complète du marché avec 14M+ d'aliments vérifiés
- **Écosystème d'intégrations** : Compatible avec Apple Health, Garmin, Fitbit, Strava et 100+ partenaires
- **Effet réseau** : La communauté crée un verrou puissant (partage de recettes, challenges)

## Points faibles exploitables
- **Coaching personnalisé** : Approche one-size-fits-all, pas d'adaptation IA en temps réel
- **UX dépassée** : L'interface n'a pas fondamentalement évolué depuis 2018
- **Positionnement calorie-centrique** : Stigmatisant pour certains segments, approche holistique manquante

## Opportunité FitnessPro
Nous pouvons nous différencier sur le coaching adaptatif IA et l'expérience utilisateur moderne, en ciblant les utilisateurs frustrés par la complexité de MFP.`,
    },
    {
      competitorName: 'Freeletics',
      competitorUrl: 'https://www.freeletics.com',
      score: 72,
      serpData: {
        organicKeywords: 8400,
        estimatedTraffic: 920000,
        topKeywords: ['bodyweight training', 'hiit workout app', 'AI fitness coach'],
        domainAuthority: 68,
        backlinks: 125000,
      },
      socialData: {
        instagram: { followers: 890000, avgEngagement: 2.4, postsPerWeek: 6 },
        facebook: { followers: 1800000, avgEngagement: 0.9, postsPerWeek: 4 },
        youtube: { subscribers: 320000, avgViews: 45000, videosPerMonth: 8 },
      },
      strengths: [
        'Coach IA leader sur le bodyweight training',
        'Contenu vidéo de haute qualité avec démonstrations',
        'Forte présence européenne, bon positionnement FR/DE',
        'Programmes adaptatifs selon la performance utilisateur',
      ],
      weaknesses: [
        'Pas de suivi nutritionnel intégré',
        'Prix élevé (90€/an) sans option gratuite satisfaisante',
        'Focus exclusif bodyweight, pas de salle/équipement',
        'Taux de rétention faible après les 12 premières semaines',
      ],
      fullReport: `# Analyse Concurrentielle - Freeletics

## Vue d'ensemble
Freeletics est une app allemande de fitness axée sur le bodyweight training avec coaching IA. Plus de 55 millions d'utilisateurs dans 160 pays, avec une forte pénétration en Europe.

## Points forts
- **Coach IA avancé** : Adaptation réelle des programmes selon les retours utilisateur
- **Production contenu** : Vidéos d'exercices de qualité professionnelle
- **Marché européen** : Positionnement fort en France et en Allemagne

## Points faibles exploitables
- **Nutrition absente** : Pas d'approche holistique fitness + nutrition
- **Monotonie** : Le bodyweight seul devient limitant pour les utilisateurs avancés
- **Rétention** : Chute significative d'engagement après le 3ème mois

## Opportunité FitnessPro
Notre approche combinée fitness + nutrition + communauté répond directement aux lacunes de Freeletics. Prix plus accessible avec plus de valeur perçue.`,
    },
    {
      competitorName: 'Nike Training Club',
      competitorUrl: 'https://www.nike.com/ntc-app',
      score: 81,
      serpData: {
        organicKeywords: 18600,
        estimatedTraffic: 4200000,
        topKeywords: ['nike workout', 'free workout app', 'home workout'],
        domainAuthority: 94,
        backlinks: 890000,
      },
      socialData: {
        instagram: { followers: 5600000, avgEngagement: 1.2, postsPerWeek: 10 },
        facebook: { followers: 8900000, avgEngagement: 0.4, postsPerWeek: 6 },
        youtube: { subscribers: 1800000, avgViews: 180000, videosPerMonth: 12 },
      },
      strengths: [
        'Marque Nike ultra-puissante, confiance immédiate',
        'Application 100% gratuite, pas de paywall',
        'Contenu premium avec des athlètes et coachs reconnus',
        'Écosystème Nike (chaussures, vêtements, Nike Run Club)',
      ],
      weaknesses: [
        'Pas de personnalisation IA, programmes fixes',
        'Monétisation indirecte (vente produits Nike), pas de modèle SaaS',
        'Communauté peu interactive, pas de social features',
        'Pas de suivi de progression détaillé ni analytics utilisateur',
      ],
      fullReport: `# Analyse Concurrentielle - Nike Training Club

## Vue d'ensemble
NTC est l'application fitness gratuite de Nike avec plus de 200 workouts guidés par des coachs de renom. Gratuit depuis 2020, c'est un outil de branding plus qu'un produit SaaS.

## Points forts
- **Marque** : La notoriété Nike élimine toute barrière de confiance
- **Gratuité** : Aucun concurrent SaaS ne peut rivaliser sur le prix
- **Qualité contenu** : Production hollywoodienne, coachs celebrity

## Points faibles exploitables
- **Zéro personnalisation** : Pas d'IA, pas d'adaptation au niveau de l'utilisateur
- **Pas de nutrition** : Focus uniquement exercice
- **Pas de communauté** : Expérience solitaire, aucun social feature
- **Analytics faibles** : Pas de suivi de progression avancé

## Opportunité FitnessPro
NTC crée une attente de qualité mais ne délivre pas sur la personnalisation et la communauté. Les utilisateurs NTC frustrés par le manque de suivi sont notre cible idéale de conversion.`,
    },
  ];

  for (const comp of competitors) {
    await prisma.competitiveAnalysis.create({
      data: { ...comp, projectId: project1.id },
    });
  }

  console.log('Created 3 competitive analyses.');

  // ---------------------------------------------------------------------------
  // 4. Strategy for FitnessPro
  // ---------------------------------------------------------------------------
  await prisma.strategy.create({
    data: {
      projectId: project1.id,
      approved: true,
      positioning: `FitnessPro se positionne comme le coach fitness IA francophone #1, combinant entraînement personnalisé, suivi nutritionnel intelligent et communauté motivante.

**Proposition de valeur unique** : "Votre coach personnel IA qui s'adapte à votre vie, pas l'inverse."

**Positionnement marché** : Premium accessible (9,99€/mois) entre le gratuit (NTC) et le premium rigide (Freeletics à 90€/an). Nous visons le segment "fitness curious" : des personnes motivées mais mal accompagnées.

**Différenciateurs clés** :
1. IA conversationnelle qui ajuste les programmes en temps réel
2. Approche holistique : entraînement + nutrition + sommeil + stress
3. Communauté francophone avec challenges locaux
4. Intégration Apple Health / Google Fit native`,

      messaging: {
        tagline: 'Votre coach IA, votre rythme.',
        elevatorPitch:
          "FitnessPro est l'application de coaching fitness qui utilise l'intelligence artificielle pour créer des programmes 100% personnalisés. Contrairement aux apps génériques, FitnessPro s'adapte à votre niveau, votre emploi du temps et vos objectifs en temps réel.",
        toneOfVoice: 'Motivant sans être agressif, expert mais accessible, moderne et bienveillant',
        keyMessages: [
          "L'IA qui comprend votre corps et votre vie",
          'Résultats visibles en 30 jours ou remboursé',
          'Rejoint par 5 000+ sportifs francophones',
          'Nutrition + Entraînement + Communauté = Résultats',
        ],
        doAndDont: {
          do: ['Utiliser le tutoiement', 'Montrer des résultats réels', 'Célébrer les petites victoires'],
          dont: ['Body shaming', 'Promesses irréalistes', 'Jargon trop technique'],
        },
      },

      personas: [
        {
          name: 'Sophie, 32 ans',
          title: 'La maman active',
          description:
            "Cadre en entreprise, mère de deux enfants. Veut retrouver la forme après sa deuxième grossesse mais n'a que 30 min par jour. Cherche efficacité et flexibilité.",
          goals: ['Perdre 8kg en 4 mois', 'Retrouver de l\'énergie', 'Routine faisable à la maison'],
          frustrations: ['Pas le temps d\'aller en salle', 'Apps trop complexes', 'Programmes inadaptés post-partum'],
          channels: ['Instagram', 'Facebook Groups', 'Podcasts bien-être'],
          budget: '10-15€/mois',
        },
        {
          name: 'Karim, 27 ans',
          title: 'Le jeune pro ambitieux',
          description:
            'Développeur en startup, passionné de tech. Fait du sport irrégulièrement et veut structurer sa routine. Sensible à l\'aspect data et tracking.',
          goals: ['Prendre de la masse musculaire', 'Routine 4x/semaine', 'Optimiser sa nutrition'],
          frustrations: ['Infobésité fitness sur YouTube', 'Apps sans vrai coaching', 'Pas de suivi data avancé'],
          channels: ['YouTube', 'Reddit', 'Twitter/X', 'Product Hunt'],
          budget: '10-20€/mois',
        },
        {
          name: 'Catherine, 48 ans',
          title: 'La reconversion bien-être',
          description:
            'Ex-cadre en reconversion, découvre le fitness à 45 ans. Cherche une approche douce et progressive, sans pression ni jugement.',
          goals: ['Améliorer sa santé globale', 'Gérer le stress', 'Créer une habitude durable'],
          frustrations: ['Apps pensées pour les jeunes', 'Peur du jugement en salle', 'Exercices trop intenses'],
          channels: ['Facebook', 'Newsletter santé', 'Magazines féminins online'],
          budget: '10€/mois max',
        },
      ],

      channels: [
        {
          name: 'Meta Ads (Instagram + Facebook)',
          priority: 'HIGH',
          budgetPercent: 40,
          rationale: 'Canal #1 pour l\'acquisition B2C fitness. CPL estimé 3-5€ avec des créas vidéo.',
          tactics: ['Video ads transformation', 'Carousel features', 'Retargeting visiteurs site'],
        },
        {
          name: 'Google Ads (Search + YouTube)',
          priority: 'HIGH',
          budgetPercent: 25,
          rationale: 'Capturer l\'intent "application fitness" et "coach sportif en ligne". YouTube pour la notoriété.',
          tactics: ['Search branded + generic', 'YouTube pre-roll 15s', 'Performance Max'],
        },
        {
          name: 'Content Marketing (Blog + SEO)',
          priority: 'MEDIUM',
          budgetPercent: 20,
          rationale: 'Trafic organique long-terme. Articles fitness/nutrition pour le SEO + lead magnets.',
          tactics: ['Blog 3 articles/semaine', 'Guest posts', 'Lead magnet "Programme 30 jours"'],
        },
        {
          name: 'Email Marketing',
          priority: 'MEDIUM',
          budgetPercent: 10,
          rationale: 'Nurturing des leads et réactivation. Canal le plus rentable en LTV.',
          tactics: ['Welcome sequence 7 emails', 'Newsletter hebdo', 'Win-back automatisé'],
        },
        {
          name: 'Influence Marketing',
          priority: 'LOW',
          budgetPercent: 5,
          rationale: 'Micro-influenceurs fitness FR pour la preuve sociale.',
          tactics: ['10 micro-influenceurs (10-50k)', 'Programme ambassadeur', 'UGC challenges'],
        },
      ],

      calendar: {
        overview: 'Plan de lancement sur 90 jours, de la phase de pré-lancement au scaling.',
        weeks: [
          {
            week: 1,
            theme: 'Pré-lancement & Teasing',
            tasks: [
              'Créer la landing page avec waitlist',
              'Lancer les comptes sociaux (IG, FB, TikTok)',
              'Rédiger les 5 premiers articles SEO',
              'Configurer le pixel Meta et Google Tag Manager',
            ],
          },
          {
            week: 2,
            theme: 'Content Machine',
            tasks: [
              'Publier 3 posts/jour sur Instagram (tips, before/after, témoignages)',
              'Lancer la première campagne Meta Ads (awareness)',
              'Envoyer la première newsletter aux inscrits waitlist',
              'Produire 2 vidéos YouTube (tutoriel app + témoignage)',
            ],
          },
          {
            week: 3,
            theme: 'Lancement Officiel',
            tasks: [
              'Ouvrir les inscriptions avec offre early-bird -30%',
              'Activer les campagnes Google Search',
              'Lancer le challenge "30 jours FitnessPro" sur Instagram',
              'Envoyer la séquence email de lancement (5 emails sur 5 jours)',
            ],
          },
          {
            week: 4,
            theme: 'Optimisation & Scale',
            tasks: [
              'Analyser les premières métriques (CAC, taux conversion, retention J7)',
              'A/B tester les créas publicitaires (3 variantes)',
              'Lancer la campagne retargeting pour les visiteurs non-convertis',
              'Premier bilan et ajustement du budget par canal',
            ],
          },
          { week: 5, theme: 'Communauté & UGC', tasks: ['Lancer le programme ambassadeur', 'Premier live Instagram Q&A', 'Collecter les premiers témoignages vidéo'] },
          { week: 6, theme: 'SEO Push', tasks: ['Publier les articles piliers (3000+ mots)', 'Campagne de link building', 'Optimiser les pages d\'atterrissage'] },
          { week: 7, theme: 'Paid Media Scale', tasks: ['Augmenter budget Meta Ads de 50%', 'Lancer YouTube Ads', 'Tester les créas UGC en publicité'] },
          { week: 8, theme: 'Email Automation', tasks: ['Déployer la séquence win-back', 'Segmenter la base par engagement', 'Lancer les emails de cross-sell nutrition'] },
          { week: 9, theme: 'Influence Wave 1', tasks: ['Activer les 5 premiers micro-influenceurs', 'Lancer le hashtag challenge #FitnessProChallenge'] },
          { week: 10, theme: 'Data & Optimisation', tasks: ['Audit complet des performances par canal', 'Réallocation budgétaire basée sur le ROAS'] },
          { week: 11, theme: 'Expansion Contenu', tasks: ['Lancer le podcast "Fit Talk"', 'Partenariats media fitness FR'] },
          { week: 12, theme: 'Bilan Q1 & Planning Q2', tasks: ['Rapport complet 90 jours', 'Définir les objectifs Q2', 'Préparer la stratégie de rétention'] },
        ],
      },

      valueProps: [
        {
          title: 'Coaching IA personnalisé',
          description: "Notre IA analyse vos performances et adapte votre programme en temps réel. Fini les plans génériques qui ne marchent pas.",
          icon: 'brain',
        },
        {
          title: 'Tout-en-un : Sport + Nutrition + Bien-être',
          description: "Un seul abonnement pour gérer votre entraînement, votre alimentation et votre récupération. L'approche holistique qui donne des résultats.",
          icon: 'target',
        },
        {
          title: 'Communauté francophone motivante',
          description: 'Rejoignez 5 000+ sportifs francophones. Challenges, partage de résultats et soutien mutuel pour ne jamais lâcher.',
          icon: 'users',
        },
        {
          title: 'Résultats garantis en 30 jours',
          description: "Satisfait ou remboursé. 87% de nos utilisateurs constatent des résultats visibles dès le premier mois.",
          icon: 'check-circle',
        },
      ],

      angles: [
        {
          name: 'Angle transformation',
          hook: 'J\'ai perdu 12kg en 3 mois sans mettre les pieds en salle',
          targetPersona: 'Sophie',
          channels: ['Instagram', 'Facebook'],
        },
        {
          name: 'Angle data/tech',
          hook: "L'app fitness qui utilise la même IA que ChatGPT pour vos muscles",
          targetPersona: 'Karim',
          channels: ['Twitter/X', 'YouTube', 'Reddit'],
        },
        {
          name: 'Angle bienveillance',
          hook: "Il n'est jamais trop tard pour commencer. Votre corps vous remerciera.",
          targetPersona: 'Catherine',
          channels: ['Facebook', 'Email'],
        },
        {
          name: 'Angle FOMO/social proof',
          hook: '5 247 personnes se sont inscrites cette semaine. Et vous ?',
          targetPersona: 'All',
          channels: ['Meta Ads', 'Landing Page'],
        },
      ],

      fullDocument: `# Stratégie Marketing FitnessPro App - Document Complet

## Résumé Exécutif
FitnessPro vise à devenir l'application de coaching fitness IA #1 en France. Avec un budget de 5 000€/mois, nous ciblons 10 000 utilisateurs actifs en 6 mois via une stratégie multi-canal axée sur l'acquisition payante, le content marketing et la communauté.

## Objectifs Stratégiques
- **Acquisition** : 10 000 signups en 6 mois (CAC cible : 8€)
- **Rétention** : 45% de rétention à M+1
- **Revenue** : MRR de 25 000€ à M+6

Ce document constitue la feuille de route complète pour le lancement et le scaling de FitnessPro sur le marché français.`,
    },
  });

  console.log('Created strategy.');

  // ---------------------------------------------------------------------------
  // 5. Content items (15+ pieces)
  // ---------------------------------------------------------------------------
  const now = new Date();
  const futureDate = (daysFromNow: number) => new Date(now.getTime() + daysFromNow * 86400000);

  const contentItems = [
    // Social posts (5)
    {
      type: 'SOCIAL_POST' as const,
      platform: 'INSTAGRAM' as const,
      title: 'Lancement - Teaser transformation',
      body: "Tu veux des résultats visibles en 30 jours ? Notre IA analyse ton niveau et crée un programme 100% adapté à ta vie.\n\nPas besoin de salle. Pas besoin de 2h par jour. Juste 30 minutes et un coach qui te comprend.\n\n#FitnessPro #CoachIA #FitnessMotivation #TransformationPhysique",
      bodyVariantB: "30 jours. 30 minutes par jour. Des résultats que tu n'aurais jamais cru possibles.\n\nFitnessPro, c'est le coach IA qui s'adapte à TON rythme, TON niveau, TES objectifs.\n\nEt si tu commençais aujourd'hui ?\n\n#FitnessPro #FitnessIA #Motivation #SportMaison",
      visualPrompt: 'Split screen before/after fitness transformation, dark moody gym background, neon blue accent, Instagram square format',
      status: 'PUBLISHED' as const,
      publishedAt: new Date('2026-03-01'),
      metrics: { likes: 342, comments: 28, shares: 15, saves: 89, reach: 12400 },
    },
    {
      type: 'SOCIAL_POST' as const,
      platform: 'FACEBOOK' as const,
      title: 'Témoignage utilisateur - Sophie',
      body: "\"J'ai retrouvé mon énergie de maman grâce à FitnessPro.\"\n\nSophie, 32 ans, 2 enfants, a perdu 8kg en 3 mois avec seulement 30 minutes par jour.\n\nSon secret ? Un programme adapté à son emploi du temps de maman active. Pas de culpabilité, pas de pression. Juste du progrès, à son rythme.\n\nDécouvrez son histoire complète et commencez votre propre transformation.",
      bodyVariantB: "Sophie avait essayé 4 apps fitness avant FitnessPro. Aucune ne comprenait qu'une maman de 2 enfants ne peut pas s'entraîner 1h par jour.\n\nFitnessPro lui a créé un programme de 25 minutes, adapté à ses horaires. Résultat : -8kg en 12 semaines.\n\nVotre transformation commence ici.",
      status: 'APPROVED' as const,
      scheduledAt: futureDate(3),
    },
    {
      type: 'SOCIAL_POST' as const,
      platform: 'LINKEDIN' as const,
      title: 'L\'IA révolutionne le fitness',
      body: "Le marché du fitness digital explose : 30 milliards de dollars en 2026.\n\nMais 73% des utilisateurs abandonnent leur app fitness dans les 30 premiers jours. Pourquoi ?\n\nParce que les programmes sont génériques. One-size-fits-all ne marche pas quand chaque corps est unique.\n\nChez FitnessPro, nous avons construit un coach IA qui apprend de chaque session pour créer une expérience véritablement personnalisée.\n\nLes premiers résultats sont prometteurs : 87% de rétention à J30 vs. 27% pour la moyenne du secteur.\n\n#FitTech #IA #Startup #FitnessDigital",
      status: 'DRAFT' as const,
    },
    {
      type: 'SOCIAL_POST' as const,
      platform: 'INSTAGRAM' as const,
      title: 'Carousel - 5 erreurs fitness',
      body: "5 erreurs qui sabotent tes résultats en salle (et comment les corriger) :\n\n1/ Tu ne dors pas assez (7h minimum)\n2/ Tu sautes le petit-déjeuner après ton entraînement\n3/ Tu fais toujours les mêmes exercices\n4/ Tu ne track pas tes progrès\n5/ Tu t'entraînes sans plan\n\nFitnessPro corrige tout ça automatiquement avec son coach IA. Lien en bio.",
      bodyVariantB: "STOP. Avant ta prochaine séance, lis ça.\n\n5 erreurs que 90% des sportifs font (et qui ruinent leurs résultats).\n\nSwipe pour découvrir lesquelles et comment notre IA les corrige automatiquement.",
      visualPrompt: 'Instagram carousel, 6 slides, dark theme with blue accents, fitness icons, clean typography',
      status: 'SCHEDULED' as const,
      scheduledAt: futureDate(5),
    },
    {
      type: 'SOCIAL_POST' as const,
      platform: 'FACEBOOK' as const,
      title: 'Challenge 30 jours',
      body: "Le Challenge FitnessPro 30 Jours commence lundi !\n\n30 minutes/jour, un programme adapté à ton niveau, et une communauté pour te motiver.\n\nCe qui est inclus :\n- Programme IA personnalisé\n- Plan nutrition hebdomadaire\n- Accès au groupe privé\n- Coaching quotidien\n\nInscription gratuite pour les 500 premiers. Qui est partant ?",
      status: 'DRAFT' as const,
    },
    // Ad copies (3)
    {
      type: 'AD_COPY' as const,
      platform: 'FACEBOOK' as const,
      title: 'Meta Ad - Acquisition Cold',
      body: JSON.stringify({
        headline: 'Ton coach fitness IA personnel',
        primaryText: "Arrête de perdre du temps avec des programmes génériques. FitnessPro crée un plan d'entraînement 100% adapté à ton niveau, ton emploi du temps et tes objectifs. Résultats visibles en 30 jours ou remboursé.",
        description: '9,99€/mois - Essai 14 jours gratuit',
        callToAction: 'SIGN_UP',
        link: 'https://fitnesspro.app/start',
      }),
      bodyVariantB: JSON.stringify({
        headline: '30 min/jour suffisent',
        primaryText: "Sophie a perdu 8kg en 3 mois avec FitnessPro. Son secret ? Un coach IA qui adapte chaque séance à sa vie de maman active. Pas de salle, pas de 2h d'entraînement. Juste 30 minutes et des résultats.",
        description: 'Rejoins 5 000+ sportifs - Essai gratuit',
        callToAction: 'LEARN_MORE',
        link: 'https://fitnesspro.app/sophie',
      }),
      status: 'APPROVED' as const,
    },
    {
      type: 'AD_COPY' as const,
      platform: 'GOOGLE' as const,
      title: 'Google Search Ad - Application fitness',
      body: JSON.stringify({
        headlines: [
          'Coach Fitness IA Personnalisé',
          'Programme Sur-Mesure en 30s',
          'Résultats Garantis 30 Jours',
          'Essai Gratuit 14 Jours',
          'FitnessPro - Coach IA #1',
        ],
        descriptions: [
          "L'IA qui crée votre programme fitness personnalisé. Sport + Nutrition + Suivi. 9,99€/mois.",
          'Rejoignez 5 000+ utilisateurs satisfaits. Programme adapté à votre niveau en 30 secondes. Essai gratuit.',
        ],
        finalUrl: 'https://fitnesspro.app',
        path1: 'coach-ia',
        path2: 'fitness',
      }),
      status: 'PUBLISHED' as const,
      publishedAt: new Date('2026-03-05'),
    },
    {
      type: 'AD_COPY' as const,
      platform: 'FACEBOOK' as const,
      title: 'Meta Ad - Retargeting',
      body: JSON.stringify({
        headline: 'Tu hésites encore ?',
        primaryText: "Tu as visité FitnessPro mais tu n'as pas encore franchi le pas. On comprend, changer ses habitudes c'est pas facile. Mais tu sais quoi ? 87% de nos utilisateurs voient des résultats dès le premier mois. Et c'est gratuit pendant 14 jours. Qu'est-ce que tu risques ?",
        description: 'Essai gratuit 14 jours - Sans engagement',
        callToAction: 'START_NOW',
        link: 'https://fitnesspro.app/try-free',
      }),
      status: 'APPROVED' as const,
      scheduledAt: futureDate(2),
    },
    // Emails (5)
    {
      type: 'EMAIL' as const,
      platform: 'EMAIL' as const,
      title: 'Welcome Email - Jour 1',
      body: `Sujet : Bienvenue chez FitnessPro ! Votre programme vous attend.

Salut {{firstName}},

Vous venez de rejoindre la communauté FitnessPro et on est super contents de vous accueillir !

Votre coach IA a déjà commencé à analyser votre profil pour créer un programme 100% personnalisé. Voici ce qui vous attend :

**Cette semaine :**
- Votre premier programme d'entraînement personnalisé (prêt dans 24h)
- Votre plan nutrition adapté à vos objectifs
- Accès au groupe privé de la communauté

**Pour bien démarrer, 3 étapes :**
1. Complétez votre profil fitness (2 minutes)
2. Définissez vos objectifs et votre planning
3. Lancez votre première séance demain matin

[Compléter mon profil →]

À très vite sur FitnessPro !

Marie - Équipe FitnessPro`,
      status: 'PUBLISHED' as const,
      publishedAt: new Date('2026-02-15'),
    },
    {
      type: 'EMAIL' as const,
      platform: 'EMAIL' as const,
      title: 'Onboarding Email - Jour 3',
      body: `Sujet : Votre programme est prêt. Commençons !

{{firstName}}, votre coach IA a analysé votre profil.

Voici ce qu'il a préparé pour vous :
- {{workoutCount}} séances par semaine de {{duration}} minutes
- Focus : {{primaryGoal}}
- Difficulté : adaptée à votre niveau {{level}}

Les premiers résultats arrivent généralement entre la 2ème et 4ème semaine. La clé ? La régularité.

On vous a préparé une séance spéciale "Jour 1" de 20 minutes seulement. Parfaite pour démarrer en douceur.

[Lancer ma première séance →]

Conseil du coach : faites votre première séance dans les 48h. Les utilisateurs qui démarrent rapidement ont 3x plus de chances d'atteindre leurs objectifs.`,
      status: 'APPROVED' as const,
    },
    {
      type: 'EMAIL' as const,
      platform: 'EMAIL' as const,
      title: 'Engagement Email - Jour 7',
      body: `Sujet : Semaine 1 terminée ! Vos stats sont impressionnantes.

Hey {{firstName}} !

Première semaine bouclée, et vos stats parlent d'elles-mêmes :

- {{sessionsCompleted}} séances complétées
- {{totalMinutes}} minutes d'entraînement
- {{caloriesBurned}} calories brûlées

Vous êtes dans le top 20% des débutants FitnessPro. Sérieusement.

Cette semaine, votre coach IA a ajusté votre programme en fonction de vos performances. Vous allez sentir la différence.

[Voir mon programme semaine 2 →]

PS : Rejoignez le challenge de la semaine dans le groupe communauté. 342 personnes participent déjà !`,
      status: 'DRAFT' as const,
    },
    {
      type: 'EMAIL' as const,
      platform: 'EMAIL' as const,
      title: 'Conversion Email - Fin essai',
      body: `Sujet : Votre essai gratuit se termine demain

{{firstName}},

En 14 jours, vous avez :
- Complété {{totalSessions}} séances
- Brûlé {{totalCalories}} calories
- Progressé de {{progressPercent}}% vers votre objectif

Votre coach IA a appris à vous connaître. Il sait exactement ce dont vous avez besoin pour la suite.

Pour continuer votre progression, passez à FitnessPro Premium :

**9,99€/mois** - Tout inclus
- Coach IA illimité
- Plans nutrition personnalisés
- Communauté et challenges
- Analytics avancés

[Continuer ma progression → ]

Si FitnessPro n'est pas fait pour vous, aucun souci. Votre programme reste accessible en lecture seule.

Mais on espère sincèrement vous garder dans l'équipe.`,
      status: 'APPROVED' as const,
    },
    {
      type: 'EMAIL' as const,
      platform: 'EMAIL' as const,
      title: 'Win-back Email - Jour 30',
      body: `Sujet : On ne vous a pas oublié, {{firstName}}

Ça fait un moment qu'on ne vous a pas vu sur FitnessPro.

On sait que la vie est chargée. Pas de jugement ici.

Mais on voulait vous dire : votre programme vous attend toujours. Et votre coach IA a continué à s'améliorer.

Nouveautés depuis votre dernière visite :
- 50 nouveaux exercices vidéo
- Plans nutrition végétariens et sans gluten
- Séances express de 15 minutes

Pour fêter votre retour : **-50% pendant 3 mois** avec le code COMEBACK.

[Revenir sur FitnessPro →]

On vous attend !`,
      status: 'DRAFT' as const,
    },
    // Blog posts / Landing page (2)
    {
      type: 'BLOG_POST' as const,
      title: 'Comment perdre du poids avec une app fitness IA en 2026',
      body: `# Comment perdre du poids avec une app fitness IA en 2026 : Le guide complet

## Introduction
Le marché des applications fitness a explosé ces dernières années, mais un problème persiste : 73% des utilisateurs abandonnent dans le premier mois. La raison ? Des programmes génériques qui ne tiennent pas compte de votre réalité.

En 2026, l'intelligence artificielle change la donne. Les coachs IA ne se contentent plus de vous donner des exercices : ils apprennent de vos performances, s'adaptent à votre emploi du temps et personnalisent chaque aspect de votre parcours fitness.

## Pourquoi les apps fitness classiques échouent
Les applications traditionnelles proposent des plans d'entraînement standardisés. Que vous soyez débutant ou avancé, homme ou femme de 25 ou 50 ans, vous recevez souvent le même programme.

**Les 3 raisons principales d'abandon :**
1. **Inadaptation** : Le programme est trop facile ou trop difficile
2. **Rigidité** : Impossible de s'adapter à un emploi du temps changeant
3. **Solitude** : Pas de soutien ni de feedback personnalisé

## Comment l'IA résout ces problèmes
Un coach IA analyse en temps réel vos données : performances, fréquence cardiaque, habitudes de sommeil, niveau de fatigue. Il ajuste votre programme à chaque session.

## Conclusion
L'IA rend enfin possible ce que les coachs sportifs font depuis toujours : un accompagnement personnalisé. Mais à une fraction du prix et disponible 24h/24.`,
      status: 'PUBLISHED' as const,
      publishedAt: new Date('2026-02-28'),
      metrics: { views: 2340, uniqueVisitors: 1890, avgTimeOnPage: 245, bounceRate: 42 },
    },
    {
      type: 'LANDING_PAGE' as const,
      title: 'Landing Page - Essai Gratuit',
      body: `# Hero Section
**Headline:** Votre coach fitness IA personnel. Résultats visibles en 30 jours.
**Subheadline:** Programme 100% personnalisé. 30 minutes par jour suffisent.
**CTA:** Commencer mon essai gratuit →

# Social Proof Bar
★★★★★ 4.8/5 sur l'App Store | 5 247 sportifs actifs | 87% de résultats à J30

# Section Problème
## Vous en avez marre de...
- Programmes fitness qui ne marchent pas ?
- Apps compliquées avec trop de fonctions inutiles ?
- Entraînements qui ne s'adaptent pas à votre vie ?

# Section Solution
## FitnessPro s'adapte à VOUS
Notre IA analyse votre profil, vos objectifs et votre emploi du temps pour créer un programme unique. Chaque séance est ajustée en fonction de vos progrès.

# Section Features (3 colonnes)
**Coach IA** : Votre programme évolue avec vous
**Nutrition** : Plans repas personnalisés chaque semaine
**Communauté** : Rejoignez des milliers de sportifs motivés

# Pricing
9,99€/mois | Essai gratuit 14 jours | Sans engagement

# Final CTA
Rejoignez 5 000+ sportifs qui ont transformé leur vie.
[Démarrer gratuitement →]`,
      status: 'APPROVED' as const,
    },
  ];

  for (const item of contentItems) {
    await prisma.content.create({
      data: {
        projectId: project1.id,
        type: item.type,
        platform: item.platform ?? null,
        title: item.title ?? null,
        body: item.body,
        bodyVariantB: item.bodyVariantB ?? null,
        visualPrompt: item.visualPrompt ?? null,
        status: item.status,
        scheduledAt: item.scheduledAt ?? null,
        publishedAt: item.publishedAt ?? null,
        metrics: item.metrics ?? undefined,
      },
    });
  }

  console.log('Created 15 content items.');

  // ---------------------------------------------------------------------------
  // 6. Ad Campaigns
  // ---------------------------------------------------------------------------
  await prisma.adCampaign.create({
    data: {
      projectId: project1.id,
      platform: 'FACEBOOK',
      externalId: 'meta_camp_120392847561',
      name: 'FitnessPro - Acquisition Cold Audiences',
      objective: 'CONVERSIONS',
      budget: 50,
      budgetType: 'DAILY',
      targeting: {
        audiences: [
          { type: 'interest', name: 'Fitness & Wellness', size: 12000000 },
          { type: 'interest', name: 'Weight Loss', size: 8500000 },
          { type: 'lookalike', name: 'LAL 1% Subscribers', size: 450000 },
        ],
        ageRange: { min: 25, max: 45 },
        gender: 'all',
        locations: ['FR'],
        placements: ['instagram_feed', 'instagram_stories', 'facebook_feed', 'facebook_reels'],
        exclusions: ['existing_customers', 'app_installers'],
      },
      creatives: {
        adSets: [
          { name: 'Interest - Fitness', budget: 25, status: 'ACTIVE' },
          { name: 'LAL - Subscribers', budget: 25, status: 'ACTIVE' },
        ],
        ads: [
          { name: 'Video - Transformation', format: 'video', status: 'ACTIVE' },
          { name: 'Carousel - Features', format: 'carousel', status: 'ACTIVE' },
          { name: 'Static - Testimonial', format: 'image', status: 'PAUSED' },
        ],
      },
      status: 'ACTIVE',
      metrics: {
        impressions: 148920,
        clicks: 4231,
        ctr: 2.84,
        cpc: 0.59,
        spend: 2496.29,
        conversions: 312,
        costPerConversion: 8.0,
        roas: 3.92,
        frequency: 2.1,
        reach: 70914,
      },
      autoOptimize: true,
    },
  });

  await prisma.adCampaign.create({
    data: {
      projectId: project1.id,
      platform: 'GOOGLE',
      externalId: 'gads_camp_9821345678',
      name: 'FitnessPro - Search Intent',
      objective: 'CLICKS',
      budget: 30,
      budgetType: 'DAILY',
      targeting: {
        keywords: [
          { match: 'phrase', keyword: 'application fitness personnalisée', bid: 1.2 },
          { match: 'phrase', keyword: 'coach sportif en ligne', bid: 0.95 },
          { match: 'broad', keyword: 'app fitness IA', bid: 0.85 },
          { match: 'exact', keyword: 'fitnesspro', bid: 0.3 },
        ],
        locations: ['FR'],
        languages: ['fr'],
        negativeKeywords: ['gratuit', 'crack', 'avis négatif'],
      },
      creatives: {
        responsiveSearchAds: [
          {
            headlines: ['Coach Fitness IA Personnalisé', 'Programme Sur-Mesure', 'Essai Gratuit 14 Jours'],
            descriptions: ["L'IA crée votre programme fitness. Sport + Nutrition. 9,99€/mois.", 'Rejoignez 5 000+ utilisateurs. Résultats garantis 30 jours.'],
          },
        ],
      },
      status: 'ACTIVE',
      metrics: {
        impressions: 52340,
        clicks: 3891,
        ctr: 7.43,
        cpc: 0.46,
        spend: 1789.86,
        conversions: 198,
        costPerConversion: 9.04,
        qualityScore: 8.2,
        impressionShare: 34.7,
      },
      autoOptimize: true,
    },
  });

  await prisma.adCampaign.create({
    data: {
      projectId: project1.id,
      platform: 'FACEBOOK',
      externalId: 'meta_camp_120398712455',
      name: 'FitnessPro - Retargeting Visiteurs Site',
      objective: 'TRAFFIC',
      budget: 500,
      budgetType: 'LIFETIME',
      targeting: {
        audiences: [
          { type: 'custom', name: 'Website Visitors 30d', size: 18500 },
          { type: 'custom', name: 'Add to Cart Abandonners', size: 3200 },
          { type: 'custom', name: 'Video Viewers 50%+', size: 8900 },
        ],
        ageRange: { min: 22, max: 50 },
        gender: 'all',
        locations: ['FR'],
        placements: ['instagram_feed', 'instagram_stories', 'facebook_feed'],
      },
      creatives: {
        ads: [
          { name: 'Retarget - Social Proof', format: 'image', status: 'ACTIVE' },
          { name: 'Retarget - Urgency', format: 'video', status: 'ACTIVE' },
        ],
      },
      status: 'ACTIVE',
      metrics: {
        impressions: 34560,
        clicks: 2145,
        ctr: 6.21,
        cpc: 0.23,
        spend: 493.35,
        conversions: 89,
        costPerConversion: 5.54,
        roas: 5.67,
        frequency: 3.4,
        reach: 10165,
      },
      autoOptimize: true,
    },
  });

  console.log('Created 3 ad campaigns.');

  // ---------------------------------------------------------------------------
  // 7. Email Sequences & Leads
  // ---------------------------------------------------------------------------
  const seq1 = await prisma.emailSequence.create({
    data: {
      projectId: project1.id,
      name: 'Cold Outreach - Decision Makers',
      status: 'ACTIVE',
      metrics: {
        totalSent: 420,
        totalOpened: 168,
        openRate: 40.0,
        totalReplied: 34,
        replyRate: 8.1,
        totalInterested: 12,
        conversionRate: 2.86,
      },
    },
  });

  const seq1Steps = [
    {
      order: 1,
      subject: 'Idée pour {{company}} - Fitness digital',
      body: `Bonjour {{firstName}},

Je me permets de vous contacter car j'ai remarqué que {{company}} investit dans le bien-être de ses collaborateurs.

Chez FitnessPro, nous avons développé une solution de coaching fitness IA qui s'intègre parfaitement dans les programmes de QVT (Qualité de Vie au Travail).

Nos clients corporate constatent :
- -32% d'absentéisme lié au stress
- +28% de satisfaction collaborateur
- ROI de 4,2x sur le budget bien-être

Seriez-vous disponible pour un échange de 15 minutes cette semaine ?

Cordialement,
Marie Lefèvre
Business Development - FitnessPro`,
      delayHours: 0,
      condition: null,
    },
    {
      order: 2,
      subject: 'Re: Idée pour {{company}} - Fitness digital',
      body: `{{firstName}},

Je souhaitais m'assurer que mon précédent email ne s'est pas perdu dans votre boîte.

Pour résumer en une phrase : FitnessPro aide vos collaborateurs à rester en forme avec un coach IA personnalisé, et ça coûte moins cher qu'un abonnement salle de sport.

Voici une étude de cas récente : [lien vers PDF]

Un créneau de 15 minutes cette semaine ?

Marie`,
      delayHours: 72,
      condition: 'NOT_OPENED',
    },
    {
      order: 3,
      subject: '{{company}} x FitnessPro - Étude de cas',
      body: `Bonjour {{firstName}},

J'ai préparé une simulation personnalisée pour {{company}} basée sur votre secteur et la taille de votre équipe.

En résumé :
- Coût estimé : {{estimatedCost}}€/mois
- Économies projetées : {{projectedSavings}}€/an
- Mise en place : 2 semaines

Intéressé(e) par une démo ?

Marie`,
      delayHours: 96,
      condition: 'OPENED_NOT_REPLIED',
    },
    {
      order: 4,
      subject: 'Dernière relance - Offre spéciale {{company}}',
      body: `{{firstName}},

Dernière tentative de ma part, promis !

Si le timing n'est pas bon, je comprends totalement. Mais au cas où : nous offrons actuellement 3 mois d'essai gratuit pour les entreprises de plus de 50 collaborateurs.

C'est sans engagement et la mise en place prend moins de 48h.

Si le sujet vous intéresse un jour, n'hésitez pas à me recontacter. Je serai toujours disponible.

Belle journée,
Marie`,
      delayHours: 168,
      condition: 'NOT_REPLIED',
    },
    {
      order: 5,
      subject: 'Break-up email : Bonne continuation {{firstName}}',
      body: `Bonjour {{firstName}},

Je ne vais plus vous embêter ! Clairement, le timing n'est pas le bon et je respecte ça.

Je me permets juste de vous laisser notre page avec les résultats de nos clients : [lien]

Si un jour le sujet revient sur la table chez {{company}}, vous savez où me trouver.

Je vous souhaite le meilleur pour la suite.

Marie`,
      delayHours: 336,
      condition: 'NOT_REPLIED',
    },
  ];

  for (const step of seq1Steps) {
    await prisma.emailStep.create({ data: { sequenceId: seq1.id, ...step } });
  }

  const seq2 = await prisma.emailSequence.create({
    data: {
      projectId: project1.id,
      name: 'Warm Follow-up',
      status: 'ACTIVE',
      metrics: {
        totalSent: 85,
        totalOpened: 51,
        openRate: 60.0,
        totalReplied: 19,
        replyRate: 22.4,
        totalInterested: 8,
        conversionRate: 9.4,
      },
    },
  });

  const seq2Steps = [
    {
      order: 1,
      subject: 'Suite à notre échange - Proposition FitnessPro',
      body: `Bonjour {{firstName}},

Suite à notre conversation, voici comme promis la proposition détaillée pour {{company}}.

J'ai inclus :
- Le programme adapté à vos besoins
- Les tarifs entreprise
- Le calendrier de déploiement

N'hésitez pas si vous avez des questions.

Marie`,
      delayHours: 0,
    },
    {
      order: 2,
      subject: 'Des questions sur la proposition ?',
      body: `{{firstName}},

Je voulais m'assurer que vous aviez bien reçu notre proposition et que tout était clair.

Y a-t-il des points que vous souhaiteriez approfondir ? Je peux organiser une session de Q&A avec notre équipe technique si besoin.

Marie`,
      delayHours: 120,
    },
    {
      order: 3,
      subject: 'On avance ensemble ?',
      body: `Bonjour {{firstName}},

J'espère que la proposition répond à vos attentes. Pour passer à l'étape suivante, il nous faudrait simplement :

1. Validation du périmètre (nombre de collaborateurs)
2. Choix de la formule
3. Date de kick-off souhaitée

Je reste disponible pour en discuter quand vous le souhaitez.

Marie`,
      delayHours: 240,
    },
  ];

  for (const step of seq2Steps) {
    await prisma.emailStep.create({ data: { sequenceId: seq2.id, ...step } });
  }

  // Leads
  const leadsData = [
    { email: 'jean.martin@techcorp.fr', firstName: 'Jean', lastName: 'Martin', company: 'TechCorp France', jobTitle: 'DRH', linkedinUrl: 'https://linkedin.com/in/jmartin', status: 'INTERESTED' as const, sequenceId: seq1.id },
    { email: 'sophie.bernard@groupevital.com', firstName: 'Sophie', lastName: 'Bernard', company: 'Groupe Vital', jobTitle: 'Directrice QVT', status: 'REPLIED' as const, sequenceId: seq1.id },
    { email: 'marc.dubois@innov-sante.fr', firstName: 'Marc', lastName: 'Dubois', company: 'InnovSanté', jobTitle: 'CEO', phone: '+33612345678', status: 'OPENED' as const, sequenceId: seq1.id },
    { email: 'celine.moreau@assurplus.fr', firstName: 'Céline', lastName: 'Moreau', company: 'AssurPlus', jobTitle: 'Responsable RH', status: 'CONTACTED' as const, sequenceId: seq1.id },
    { email: 'pierre.leroy@metropole-lyon.fr', firstName: 'Pierre', lastName: 'Leroy', company: 'Métropole de Lyon', jobTitle: 'Directeur Sport & Santé', status: 'INTERESTED' as const, sequenceId: seq1.id },
    { email: 'amina.kone@startupfactory.io', firstName: 'Amina', lastName: 'Koné', company: 'StartupFactory', jobTitle: 'Head of People', status: 'NEW' as const, sequenceId: seq1.id },
    { email: 'luc.girard@banque-centre.fr', firstName: 'Luc', lastName: 'Girard', company: 'Banque du Centre', jobTitle: 'DRH Adjoint', status: 'CONTACTED' as const, sequenceId: seq2.id },
    { email: 'nathalie.roux@pharmagreen.com', firstName: 'Nathalie', lastName: 'Roux', company: 'PharmaGreen', jobTitle: 'Office Manager', status: 'OPENED' as const, sequenceId: seq2.id },
    { email: 'thomas.petit@edutechfr.com', firstName: 'Thomas', lastName: 'Petit', company: 'EduTech France', jobTitle: 'COO', status: 'REPLIED' as const, sequenceId: seq2.id },
    { email: 'isabelle.faure@cosmetica.fr', firstName: 'Isabelle', lastName: 'Faure', company: 'Cosmetica', jobTitle: 'Directrice Générale', status: 'NEW' as const, sequenceId: seq2.id },
  ];

  const createdLeads = [];
  for (const lead of leadsData) {
    const created = await prisma.lead.create({
      data: {
        email: lead.email,
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company,
        jobTitle: lead.jobTitle,
        linkedinUrl: lead.linkedinUrl ?? null,
        phone: lead.phone ?? null,
        emailVerified: true,
        status: lead.status,
        sequenceId: lead.sequenceId,
        enrichmentData: {
          companySize: Math.floor(Math.random() * 500) + 50,
          industry: 'Services',
          revenue: `${Math.floor(Math.random() * 50) + 5}M EUR`,
          source: 'LinkedIn Sales Navigator',
        },
      },
    });
    createdLeads.push(created);
  }

  // Lead events
  const eventTypes = ['email_sent', 'email_opened', 'link_clicked', 'email_replied'];
  for (const lead of createdLeads) {
    // Every lead gets a "sent" event
    await prisma.leadEvent.create({
      data: {
        leadId: lead.id,
        type: 'email_sent',
        metadata: { step: 1, subject: 'Idée pour votre entreprise - Fitness digital' },
        createdAt: new Date('2026-02-20'),
      },
    });

    if (['OPENED', 'REPLIED', 'INTERESTED'].includes(lead.status)) {
      await prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: 'email_opened',
          metadata: { step: 1, openCount: Math.floor(Math.random() * 4) + 1 },
          createdAt: new Date('2026-02-21'),
        },
      });
    }

    if (['REPLIED', 'INTERESTED'].includes(lead.status)) {
      await prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: 'email_replied',
          metadata: { step: 1, sentiment: 'positive' },
          createdAt: new Date('2026-02-22'),
        },
      });
    }

    if (lead.status === 'INTERESTED') {
      await prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: 'link_clicked',
          metadata: { url: 'https://fitnesspro.app/enterprise', step: 1 },
          createdAt: new Date('2026-02-22'),
        },
      });
    }
  }

  console.log('Created 2 email sequences, 8 steps, 10 leads with events.');

  // ---------------------------------------------------------------------------
  // 8. Pipeline Jobs
  // ---------------------------------------------------------------------------
  const pipelineJobs = [
    { stage: 'competitive-analysis', status: 'COMPLETED', startedAt: new Date('2026-02-15T08:00:00Z'), completedAt: new Date('2026-02-15T08:12:34Z'), result: { competitors: 3, avgScore: 77 } },
    { stage: 'strategy-generation', status: 'COMPLETED', startedAt: new Date('2026-02-15T09:00:00Z'), completedAt: new Date('2026-02-15T09:23:12Z'), result: { personas: 3, channels: 5, calendarWeeks: 12 } },
    { stage: 'content-generation', status: 'COMPLETED', startedAt: new Date('2026-02-16T10:00:00Z'), completedAt: new Date('2026-02-16T10:45:22Z'), result: { totalPieces: 15, types: { social: 5, ads: 3, email: 5, blog: 1, landing: 1 } } },
    { stage: 'social-publishing', status: 'RUNNING', startedAt: new Date('2026-03-01T06:00:00Z'), attempts: 1, result: { published: 2, scheduled: 3, pending: 0 } },
    { stage: 'ads-campaign', status: 'PENDING', attempts: 0 },
    { stage: 'email-campaign', status: 'PENDING', attempts: 0 },
  ];

  for (const job of pipelineJobs) {
    await prisma.pipelineJob.create({
      data: {
        projectId: project1.id,
        stage: job.stage,
        status: job.status,
        startedAt: job.startedAt ?? null,
        completedAt: job.completedAt ?? null,
        attempts: job.attempts ?? 0,
        result: job.result ?? undefined,
      },
    });
  }

  console.log('Created 6 pipeline jobs.');

  // ---------------------------------------------------------------------------
  // 9. Stripe Data
  // ---------------------------------------------------------------------------
  await prisma.stripeProject.create({
    data: {
      projectId: project1.id,
      stripeCustomerId: 'cus_mock_R4x8kLm2nP',
      stripeProductId: 'prod_mock_FitnessPro2026',
      stripePriceId: 'price_mock_999monthly',
      stripeSubscriptionId: 'sub_mock_Qw3rTy7uIoP',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/mock_fitnesspro',
      status: 'ACTIVE',
      revenue: 2450.0,
    },
  });

  console.log('Created Stripe data.');

  // ---------------------------------------------------------------------------
  // 10. Audit Logs
  // ---------------------------------------------------------------------------
  const auditEntries = [
    { userId: admin.id, action: 'LOGIN', resource: 'auth', details: { method: 'credentials' }, ip: '92.184.112.45', createdAt: new Date('2026-03-01T08:15:00Z') },
    { userId: manager.id, action: 'LOGIN', resource: 'auth', details: { method: 'credentials' }, ip: '176.132.48.91', createdAt: new Date('2026-03-01T09:02:00Z') },
    { userId: manager.id, action: 'CREATE_PROJECT', resource: 'project', details: { projectId: project1.id, projectName: 'FitnessPro App' }, ip: '176.132.48.91', createdAt: new Date('2026-03-01T09:10:00Z') },
    { userId: manager.id, action: 'LAUNCH_PIPELINE', resource: 'pipeline', details: { projectId: project1.id, stage: 'competitive-analysis' }, ip: '176.132.48.91', createdAt: new Date('2026-03-01T09:12:00Z') },
    { userId: manager.id, action: 'LAUNCH_PIPELINE', resource: 'pipeline', details: { projectId: project1.id, stage: 'strategy-generation' }, ip: '176.132.48.91', createdAt: new Date('2026-03-02T10:00:00Z') },
    { userId: admin.id, action: 'APPROVE_CONTENT', resource: 'content', details: { contentType: 'SOCIAL_POST', count: 3 }, ip: '92.184.112.45', createdAt: new Date('2026-03-03T14:30:00Z') },
    { userId: manager.id, action: 'CREATE_PROJECT', resource: 'project', details: { projectId: project2.id, projectName: 'GreenBuild Guyane' }, ip: '176.132.48.91', createdAt: new Date('2026-03-04T11:00:00Z') },
    { userId: manager.id, action: 'LAUNCH_PIPELINE', resource: 'pipeline', details: { projectId: project1.id, stage: 'content-generation' }, ip: '176.132.48.91', createdAt: new Date('2026-03-05T08:45:00Z') },
    { userId: viewer.id, action: 'LOGIN', resource: 'auth', details: { method: 'credentials' }, ip: '86.220.15.73', createdAt: new Date('2026-03-06T16:20:00Z') },
    { userId: admin.id, action: 'APPROVE_CONTENT', resource: 'content', details: { contentType: 'AD_COPY', count: 2 }, ip: '92.184.112.45', createdAt: new Date('2026-03-07T09:15:00Z') },
  ];

  for (const entry of auditEntries) {
    await prisma.auditLog.create({ data: entry });
  }

  console.log('Created 10 audit logs.');

  console.log('\nSeed completed successfully!');
  console.log('-----------------------------');
  console.log('Test accounts:');
  console.log('  Admin:   admin@launchpad.io   / LaunchPad2026!');
  console.log('  Manager: demo@launchpad.io    / Demo2026!');
  console.log('  Viewer:  viewer@launchpad.io  / Viewer2026!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
