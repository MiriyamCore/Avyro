import { z } from 'zod';

/** Bangladesh e-TIN is typically 12 digits when present. */
export const tinSchema = z
  .string()
  .regex(/^\d{12}$/, 'e-TIN must be exactly 12 digits')
  .optional()
  .nullable();

/** Bangladesh BIN is typically 13 digits when present. */
export const binSchema = z
  .string()
  .regex(/^\d{13}$/, 'BIN must be exactly 13 digits')
  .optional()
  .nullable();

export const moneySchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,6})?$/, 'Invalid money amount');

export const organizationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().min(1).max(200).optional(),
  legalType: z.string().min(1).max(100).default('Sole Proprietorship'),
  businessActivity: z.string().max(200).optional(),
  countryCode: z.string().length(2).default('BD'),
  baseCurrency: z.string().length(3).default('BDT'),
  timezone: z.string().default('Asia/Dhaka'),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(7),
  fiscalYearStartDay: z.number().int().min(1).max(28).default(1),
  taxIdentifier: tinSchema,
  vatIdentifier: binSchema,
});

export const signUpSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
