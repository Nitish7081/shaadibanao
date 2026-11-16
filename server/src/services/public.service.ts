import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  ContactInquiryResponse,
  PublicContactInput,
  PublicLegalDocument,
} from '@bandhansetu/shared';
import { config } from '../config/env';
import {
  buildPrivacyPolicyDocument,
  buildTermsDocument,
} from '../config/legal.config';
import { AppError } from '../middleware/errorHandler';
import { ContactInquiryModel } from '../models/contact-inquiry.model';

const inMemoryContactStore = new Map<string, any>();

function generateSupportTicketId(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `SUP-${yyyy}${mm}${dd}-${suffix}`;
}

function isLikelySpamMessage(subject: string, message: string): boolean {
  const combined = `${subject} ${message}`;
  const urlMatches = combined.match(/https?:\/\/|www\./gi) || [];
  if (urlMatches.length > 3) {
    return true;
  }
  const spamKeywords = /\b(crypto\s*airdrop|casino\s*bonus|seo\s*backlinks|viagra|telegram\s*pump)\b/i;
  return spamKeywords.test(combined);
}

export class PublicService {
  public static getPrivacyPolicy(): PublicLegalDocument {
    return buildPrivacyPolicyDocument();
  }

  public static getTermsAndConditions(): PublicLegalDocument {
    return buildTermsDocument();
  }

  public static async submitContactInquiry(
    input: PublicContactInput,
    ipAddress?: string
  ): Promise<ContactInquiryResponse> {
    // 1. Honeypot spam protection
    if (input.website && input.website.trim().length > 0) {
      throw new AppError('Automated spam submission rejected.', 400, 'SPAM_DETECTED');
    }

    // 2. Content spam heuristics
    if (isLikelySpamMessage(input.subject, input.message)) {
      throw new AppError(
        'Your message triggered our automated spam filter. Please remove promotional links and try again.',
        400,
        'SPAM_DETECTED'
      );
    }

    if (config.isProduction && mongoose.connection.readyState !== 1) {
      throw new AppError(
        'Support database is temporarily reconnecting. Please try again in a moment.',
        503,
        'DATABASE_UNAVAILABLE'
      );
    }

    const ticketId = generateSupportTicketId();
    const now = new Date();
    const ipHash = ipAddress
      ? crypto.createHmac('sha256', config.jwt.accessSecret).update(`ip:${ipAddress}`).digest('hex')
      : undefined;

    const cleanPhone = input.phone ? input.phone.replace(/\D/g, '').slice(-10) : undefined;

    if (mongoose.connection.readyState === 1) {
      await ContactInquiryModel.create({
        ticketId,
        name: input.name,
        email: input.email,
        phone: cleanPhone || undefined,
        category: input.category || 'general_support',
        subject: input.subject,
        message: input.message,
        status: 'open',
        ipHash,
      });
    } else {
      inMemoryContactStore.set(ticketId, {
        ticketId,
        name: input.name,
        email: input.email,
        phone: cleanPhone || undefined,
        category: input.category || 'general_support',
        subject: input.subject,
        message: input.message,
        status: 'open',
        createdAt: now,
      });
    }

    return {
      ticketId,
      status: 'received',
      category: input.category || 'general_support',
      submittedAt: now.toISOString(),
      message:
        'Thank you for contacting ShaadiBanao Support. Your inquiry has been logged and assigned a tracking reference.',
    };
  }
}
