import { z } from 'zod';

export const verifyPlaySubscriptionSchema = z.object({
  productId: z.string().trim().min(1, 'productId is required').max(160),
  purchaseToken: z.string().trim().min(8, 'Valid Google Play purchaseToken is required').max(4096),
  basePlanId: z.string().trim().max(120).optional(),
  offerId: z.string().trim().max(120).optional(),
  orderId: z.string().trim().max(200).optional(),
  packageName: z.string().trim().max(160).optional(),
});

export const verifyPlayProductSchema = z.object({
  productId: z.string().trim().min(1, 'productId is required').max(160),
  purchaseToken: z.string().trim().min(8, 'Valid Google Play purchaseToken is required').max(4096),
  panditId: z.string().trim().min(1, 'panditId is required for Pandit consultation unlock').max(120),
  orderId: z.string().trim().max(200).optional(),
  packageName: z.string().trim().max(160).optional(),
});

export const restorePlayPurchasesSchema = z.object({
  purchases: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(160),
        purchaseToken: z.string().trim().min(8).max(4096),
        productType: z.enum(['subs', 'in-app']).default('subs'),
        basePlanId: z.string().trim().max(120).optional(),
        orderId: z.string().trim().max(200).optional(),
      })
    )
    .max(50),
});

export type VerifyPlaySubscriptionInput = z.infer<typeof verifyPlaySubscriptionSchema>;
export type VerifyPlayProductInput = z.infer<typeof verifyPlayProductSchema>;
export type RestorePlayPurchasesInput = z.infer<typeof restorePlayPurchasesSchema>;
