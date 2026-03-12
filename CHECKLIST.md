# LAUNCHPAD — Checklist Maître de Contrôle

## 🔧 SPRINT 0 — FONDATIONS INFRASTRUCTURE
- [x] docker-compose.yml fonctionnel (postgres, redis, app, nginx)
- [x] .env.example avec TOUTES les variables documentées
- [x] Script setup.sh d'initialisation one-click
- [x] Prisma schema complet avec migrations initiales
- [x] Health check endpoints (/api/health) pour chaque service
- [x] Logger structuré (Pino) configuré sur tous les modules
- [x] Rate limiting global configuré (Next.js middleware)

## 🔐 SPRINT 1 — AUTHENTIFICATION & MULTI-TENANT
- [x] NextAuth configuré (credentials + OAuth Google)
- [x] Modèle User avec rôles (admin, manager, viewer)
- [x] Middleware de protection des routes API et pages
- [x] Page login / register / forgot password fonctionnelle
- [x] Session persistante et refresh token
- [x] Audit log des connexions

## 📋 SPRINT 2 — SOUMISSION DE PROJET
- [x] Formulaire multi-étapes de soumission de projet
- [x] Modèle Project en base (nom, description, cible, budget, objectifs, vertical)
- [x] Upload de fichiers (logo, assets visuels, documents brief)
- [x] Validation côté client ET serveur (zod schemas)
- [x] Système de brouillons (sauvegarde auto)
- [x] Webhook de notification à la soumission
- [x] Page liste des projets avec filtres et actions

## 🔍 SPRINT 3 — ANALYSE CONCURRENTIELLE AUTOMATISÉE
- [x] Scraper de sites concurrents (structure, contenu, mots-clés)
- [x] Extraction des profils sociaux concurrents
- [x] Analyse des ads concurrents via Meta Ad Library API
- [x] Scraping Google (SERP) pour positionnement organique
- [x] Rapport d'analyse généré par Claude (forces, faiblesses, opportunités)
- [x] Matrice concurrentielle stockée en base
- [x] Score de difficulté concurrentielle calculé

## 🎯 SPRINT 4 — STRATÉGIE AUTO-GÉNÉRÉE
- [x] Pipeline Claude qui ingère l'analyse concurrentielle + brief projet
- [x] Génération d'un document stratégique complet
- [x] Calendrier éditorial auto-généré (30/60/90 jours)
- [x] Budget réparti automatiquement entre canaux
- [x] Persona cibles générés avec pain points et objections
- [x] Proposition de value props et angles d'attaque
- [x] Validation humaine optionnelle avant exécution

## ✍️ SPRINT 5 — GÉNÉRATION DE CONTENU
- [x] Posts social media générés par lot (Facebook, Instagram, LinkedIn)
- [x] Variantes A/B pour chaque post
- [x] Copywriting ads (titres, descriptions, CTA) pour Meta et Google
- [x] Séquences email cold outreach (5-7 emails par séquence)
- [x] Landing page copy générée
- [x] Visuels brief générés (prompts pour génération visuelle)
- [x] Tout le contenu stocké en base avec statut
- [x] File d'attente de review avec interface d'approbation rapide

## 📱 SPRINT 6 — PUBLICATION SOCIAL MEDIA
- [x] Intégration Vista Social API (connexion OAuth, publication programmée)
- [x] Fallback Meta Graph API pour publication directe
- [x] Scheduler de publication (respecte le calendrier éditorial)
- [x] Gestion multi-comptes / multi-pages
- [x] Upload automatique des visuels
- [x] Tracking des publications (statut, reach, engagement)
- [x] Retry automatique en cas d'échec de publication

## 💰 SPRINT 7 — CAMPAGNES ADS AUTOMATISÉES
- [x] Meta Ads : création de campagnes via Marketing API
- [x] Meta Ads : audiences custom (lookalike, retargeting pixel)
- [x] Meta Ads : budget journalier / lifetime configurable
- [x] Meta Ads : A/B test automatique des créatives
- [x] Google Ads : création campagnes Search + Display
- [x] Google Ads : keyword targeting auto
- [x] Google Ads : budget management et bid strategy
- [x] Dashboard temps réel des performances ads
- [x] Alertes automatiques si ROAS < seuil
- [x] Pause automatique des ads non performantes

## 📧 SPRINT 8 — COLD EMAIL MACHINE
- [x] Scraper de leads (Apollo.io API, CSV import)
- [x] Enrichissement de données (email, téléphone, poste)
- [x] Vérification emails (ZeroBounce API)
- [x] Warmup automatique des domaines d'envoi
- [x] Séquences multi-étapes avec conditions
- [x] Personnalisation dynamique par lead
- [x] Rotation de domaines d'envoi
- [x] Tracking ouvertures, clics, réponses
- [x] Détection auto des réponses positives (classification Claude)
- [x] Respect RGPD : opt-out automatique

## 💳 SPRINT 9 — STRIPE & MONÉTISATION
- [x] Stripe configuré (client singleton)
- [x] Création automatique de Checkout Sessions
- [x] Webhooks Stripe (payment_intent.succeeded, subscription.*, etc.)
- [x] Dashboard revenus (tRPC billing router)
- [x] Gestion abonnements (mensuel, annuel, one-shot)
- [x] Dunning management (relance impayés)

## ⚡ SPRINT 10 — ORCHESTRATION & PIPELINE
- [x] Pipeline maître BullMQ : Project → Analyse → Stratégie → Contenu → Publication → Ads → Email
- [x] Chaque étape est un job indépendant avec retry (3 tentatives, backoff exponentiel)
- [x] Dead letter queue pour les jobs échoués
- [x] Dashboard de monitoring des pipelines (stepper component)
- [x] Possibilité de relancer une étape isolément
- [x] Logs détaillés par job avec timestamps
- [x] Notifications (email + webhook) à chaque changement de statut

## 📊 SPRINT 11 — DASHBOARD & REPORTING
- [x] Dashboard principal : vue d'ensemble de tous les projets
- [x] Vue projet : pipeline status, métriques, contenu généré
- [x] Analytics : engagement social, performance ads, taux d'ouverture email
- [x] Graphiques temps réel (Recharts placeholders)
- [x] Export CSV/PDF des rapports (API routes + csv-exporter + pdf-generator)
- [ ] Comparaison avant/après par rapport aux concurrents
- [x] ROI calculé automatiquement par projet (Revenue tab)

## 🛡️ SPRINT 12 — SÉCURITÉ & PRODUCTION
- [x] Secrets management (pas de credentials en clair, Pino redact)
- [x] Headers de sécurité (middleware)
- [ ] HTTPS forcé (Let's Encrypt via Caddy ou certbot)
- [ ] Backup automatique PostgreSQL (pg_dump cron)
- [ ] Tests E2E critiques (Playwright)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Documentation API (Swagger/OpenAPI)
- [ ] Runbook opérationnel

---

**Statut global** : Production build OK ✅ — 34 routes, 0 TypeScript errors
**Dernière mise à jour** : 2026-03-12
