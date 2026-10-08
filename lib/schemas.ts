import { z } from 'zod';

const phonePattern = /^(\+?[0-9][0-9\s-]{6,19})?$/;

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const orderFormSchema = z.object({
  customerName: z.string().trim().min(2, 'Customer name is required').max(100),
  customerPhone: z
    .string()
    .trim()
    .min(1, 'Customer phone number is required')
    .regex(phonePattern, 'Enter a valid phone number'),
  location: z.string().trim().min(3, 'Delivery location is required').max(200),
  notes: z.string().trim().max(500, 'Notes are too long'),
  items: z
    .array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(50) }))
    .min(1, 'Add at least one menu item'),
});

export const userFormSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.enum(['ADMIN', 'CUSTOMER_CARE', 'KITCHEN', 'DRIVER']),
  phone: z.string().trim().regex(phonePattern, 'Enter a valid phone number'),
});

export const productFormSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  categoryId: z.coerce.number({ invalid_type_error: 'Pick a category' }).int().positive('Pick a category'),
  price: z.coerce.number({ invalid_type_error: 'Enter a price' }).int('Whole numbers only').min(0),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  phone: z.string().trim().regex(phonePattern, 'Enter a valid phone number'),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((o) => o.newPassword === o.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((o) => o.newPassword !== o.currentPassword, {
    message: 'Choose a different password',
    path: ['newPassword'],
  });

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}
