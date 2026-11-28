import { z } from 'zod';

export const sendHelloSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required').optional(),
  message: z
    .string()
    .trim()
    .min(1, 'Greeting cannot be empty')
    .max(200, 'Greeting cannot exceed 200 characters')
    .optional(),
});

export const sendFriendRequestSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required').optional(),
  note: z.string().trim().max(250, 'Note cannot exceed 250 characters').optional(),
});

export const respondFriendRequestSchema = z.object({
  action: z.enum(['accept', 'reject']).optional(),
  status: z.enum(['accepted', 'rejected']).optional(),
});

export type SendHelloInput = z.infer<typeof sendHelloSchema>;
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type RespondFriendRequestInput = z.infer<typeof respondFriendRequestSchema>;
