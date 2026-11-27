import { z } from 'zod';

export const conversationCategorySchema = z.enum([
  'matrimonial',
  'pandit_consultation',
  'booking_consultation',
]);

export const createConversationSchema = z.object({
  participantId: z.string().min(1, 'Target participant profile or user ID is required'),
  category: conversationCategorySchema.optional(),
  panditId: z.string().optional(),
  bookingId: z.string().optional(),
});

export const sendMessageSchema = z.object({
  text: z
    .string({ required_error: 'Message text is required' })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message cannot exceed 1000 characters'),
});

export const contactRequestActionSchema = z.object({
  action: z.enum(['request', 'accept', 'decline'], {
    required_error: 'Valid contact request action (request, accept, decline) is required',
  }),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ContactRequestActionInput = z.infer<typeof contactRequestActionSchema>;
