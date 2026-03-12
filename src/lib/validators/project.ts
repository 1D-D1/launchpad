/**
 * Zod validation schemas for the project creation wizard (one schema per step).
 */

import { z } from 'zod';

/**
 * Step 1: Basic information
 */
export const projectStep1Schema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(200, 'Project name must be 200 characters or less'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be 2000 characters or less'),
  vertical: z
    .string()
    .min(1, 'Please select a vertical'),
});

/**
 * Step 2: Target audience
 */
export const projectStep2Schema = z.object({
  targetAudience: z.object({
    demographics: z
      .string()
      .min(1, 'Demographics description is required')
      .max(500),
    interests: z
      .array(z.string().min(1))
      .min(1, 'Add at least one interest')
      .max(20, 'Maximum 20 interests'),
    location: z
      .string()
      .min(1, 'Location is required')
      .max(200),
    ageRange: z
      .string()
      .min(1, 'Age range is required')
      .regex(/^\d{1,2}-\d{1,2}$/, 'Age range must be in format "18-35"'),
  }),
});

/**
 * Step 3: Budget and objectives
 */
export const projectStep3Schema = z.object({
  budget: z.object({
    total: z
      .number({ message: 'Budget is required' })
      .min(0, 'Budget must be positive')
      .max(10_000_000, 'Budget exceeds maximum'),
    currency: z
      .string()
      .default('EUR'),
    allocation: z
      .record(z.string(), z.number().min(0).max(100))
      .optional()
      .refine(
        (alloc) => {
          if (!alloc) return true;
          const sum = Object.values(alloc).reduce((a: number, b: number) => a + b, 0);
          return Math.abs(sum - 100) < 0.01;
        },
        'Budget allocation percentages must sum to 100',
      ),
  }),
  objectives: z.object({
    primary: z
      .string()
      .min(1, 'Primary objective is required')
      .max(300),
    secondary: z
      .array(z.string().min(1).max(300))
      .max(5, 'Maximum 5 secondary objectives')
      .optional(),
    kpis: z
      .array(z.string().min(1).max(200))
      .max(10, 'Maximum 10 KPIs')
      .optional(),
  }),
});

/**
 * Step 4: Competitors
 */
export const projectStep4Schema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().min(1, 'Competitor name is required').max(200),
        url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
      }),
    )
    .max(10, 'Maximum 10 competitors')
    .optional(),
});

/**
 * Complete project form schema (all steps combined).
 */
export const projectFormSchema = projectStep1Schema
  .merge(projectStep2Schema)
  .merge(projectStep3Schema)
  .merge(projectStep4Schema);

/**
 * Schema for project update (all fields optional except id).
 */
export const projectUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  vertical: z.string().min(1).optional(),
  targetAudience: projectStep2Schema.shape.targetAudience.optional(),
  budget: projectStep3Schema.shape.budget.optional(),
  objectives: projectStep3Schema.shape.objectives.optional(),
  competitors: projectStep4Schema.shape.competitors,
});

/** Inferred types from schemas */
export type ProjectStep1Data = z.infer<typeof projectStep1Schema>;
export type ProjectStep2Data = z.infer<typeof projectStep2Schema>;
export type ProjectStep3Data = z.infer<typeof projectStep3Schema>;
export type ProjectStep4Data = z.infer<typeof projectStep4Schema>;
export type ProjectFormDataValidated = z.infer<typeof projectFormSchema>;
export type ProjectUpdateData = z.infer<typeof projectUpdateSchema>;
