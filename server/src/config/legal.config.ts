import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
  POLICY_LAST_UPDATED,
  PublicLegalDocument,
} from '@bandhansetu/shared';

const envOrPlaceholder = (envKey: string, placeholderLabel: string): string => {
  const val = (process.env[envKey] || '').trim();
  return val.length > 0 ? val : `[CONFIGURE: ${placeholderLabel}]`;
};

export function getPublicDeveloperContact() {
  const legalEntityName = envOrPlaceholder('PUBLIC_LEGAL_ENTITY_NAME', 'REGISTERED_LEGAL_ENTITY_NAME');
  const supportEmail = envOrPlaceholder('PUBLIC_SUPPORT_EMAIL', 'OFFICIAL_SUPPORT_EMAIL');
  const grievanceOfficerName = envOrPlaceholder('PUBLIC_GRIEVANCE_OFFICER_NAME', 'GRIEVANCE_OFFICER_NAME');
  const grievanceEmail = envOrPlaceholder('PUBLIC_GRIEVANCE_EMAIL', 'GRIEVANCE_OFFICER_EMAIL');
  const supportPhone = envOrPlaceholder('PUBLIC_SUPPORT_PHONE', 'OFFICIAL_SUPPORT_PHONE');
  const postalAddress = envOrPlaceholder('PUBLIC_REGISTERED_ADDRESS', 'REGISTERED_POSTAL_ADDRESS');

  const contactPlaceholdersConfigured = ![
    legalEntityName,
    supportEmail,
    grievanceOfficerName,
    grievanceEmail,
    supportPhone,
    postalAddress,
  ].some((v) => v.startsWith('[CONFIGURE:'));

  return {
    contactPlaceholdersConfigured,
    developerContact: {
      legalEntityName,
      supportEmail,
      grievanceOfficerName,
      grievanceEmail,
      supportPhone,
      postalAddress,
    },
  };
}

export function buildPrivacyPolicyDocument(): PublicLegalDocument {
  const { contactPlaceholdersConfigured, developerContact } = getPublicDeveloperContact();

  return {
    documentType: 'privacy_policy',
    title: 'ShaadiBanao Privacy Policy',
    version: CURRENT_PRIVACY_POLICY_VERSION,
    effectiveDate: POLICY_LAST_UPDATED,
    lastUpdated: POLICY_LAST_UPDATED,
    appName: 'ShaadiBanao',
    tagline: 'Rishton ki nayi shuruaat',
    contactPlaceholdersConfigured,
    developerContact,
    sections: [
      {
        id: 'information-we-collect',
        title: '1. Information We Collect',
        paragraphs: [
          'ShaadiBanao ("we", "our", or "us") operates the ShaadiBanao Android matrimonial application (package com.shaadibanao.app) and official website. We collect only the information necessary to provide verified Indian matrimonial matchmaking, Vedic Kundli compatibility, ceremony/Pandit booking services, community stories, moderation, and account security.',
          'Information is collected directly from you when you register, create or edit your matrimonial biodata, configure partner preferences, upload photos or verification documents, communicate with matches, book Pandit consultations, or contact support.',
        ],
      },
      {
        id: 'personal-profile-details',
        title: '2. Personal Information & Matrimonial Profile Details',
        paragraphs: [
          'When you create a matrimonial profile (for yourself, a son, daughter, brother, sister, or relative), we collect:',
        ],
        bullets: [
          'Full name (First Name and Last Name; public discovery cards redact your surname to an initial, e.g., "Priya S.").',
          'Date of birth (used to verify adult eligibility of 18+ years and calculate age) and height (in cm).',
          'Marital status, mother tongue, religion, and optional caste, gotra, and Manglik status.',
          'Family background: family values, family type (joint or nuclear), and optional father and mother occupations.',
          'Education, employment sector, occupation, optional annual income band, and your visibility preference (showIncomeBand) controlling whether income range is shown on your profile.',
          'Written biographical introduction ("About Me") and optional Vedic birth chart (Kundli) details including birth time, birth place, Rashi, Nakshatra, Charan, Lagna, and chart visibility preference (private, matches_only, or shared_with_pandit).',
        ],
      },
      {
        id: 'phone-authentication',
        title: '3. Phone Number & Authentication Information',
        paragraphs: [
          'To authenticate accounts and prevent impersonation, ShaadiBanao collects:',
        ],
        bullets: [
          '10-digit Indian mobile number (+91) when signing in via Phone OTP.',
          'Verified email address, display name, profile avatar URL, and Firebase UID when signing in via Google Sign-In (unverified email addresses are rejected).',
          'Session security credentials: short-lived JSON Web Tokens (JWT) and rotating refresh tokens stored in our database exclusively as cryptographic SHA-256 hashes. Server-side OTP challenges are hashed with bcrypt and never stored in plaintext.',
          'Explicit consent metadata: policy version, terms version, timestamp of agreement, and request IP address.',
        ],
      },
      {
        id: 'photos-uploaded-media',
        title: '4. Photos, Verification Documents & Uploaded Media',
        paragraphs: [
          'On Android, the app requests Camera and Photo Library permissions (via expo-image-picker) solely when you choose to take or select an image or PDF for upload:',
        ],
        bullets: [
          'Matrimonial Profile Photos (JPEG, PNG, WebP up to 5 MB), moderated before public display and governed by your selected photo privacy mode (everyone, after_interest_accepted, or blurred).',
          'Optional Government Identity Verification Documents (Aadhaar card, Passport, or Voter ID in JPEG, PNG, or PDF up to 8 MB) submitted with separate explicit consent to earn an ID Verified trust badge. Only a masked reference number (for example, XXXX-XXXX-1234) is stored in our database; the document file is stored in a restricted private vault.',
          'Optional Kundli chart files (up to 10 MB, stored privately) and moderated Community Story photos and captions (up to 5 MB).',
        ],
      },
      {
        id: 'gender-matrimonial-preferences',
        title: '5. Gender & Matrimonial Partner Preferences',
        paragraphs: [
          'We collect your gender (male or female) and your partner preferences (preferred age range, height range, marital statuses, religions, mother tongues, education levels, occupations, cities, and Manglik preference).',
          'ShaadiBanao enforces opposite-gender matrimonial discovery on the server based on your saved profile gender and evaluates factual preference alignment scores for prospective matches.',
        ],
      },
      {
        id: 'location-information',
        title: '6. Location Information',
        paragraphs: [
          'ShaadiBanao does NOT access real-time or background GPS device location and does NOT request Android fine or coarse location permissions.',
          'Location information processed by ShaadiBanao is limited strictly to user-entered text fields: your city, state, and country on your matrimonial profile; preferred partner cities; optional birth city/state/country (and optional coordinates if entered for Kundli calculation); and optional ceremony venue address when booking an in-person Pandit service.',
        ],
      },
      {
        id: 'device-technical-information',
        title: '7. Device & Technical Information',
        paragraphs: [
          'ShaadiBanao does not embed third-party advertising networks or behavioral ad-tracking SDKs. When our app or website communicates with our API, our servers process limited technical data:',
        ],
        bullets: [
          'IP address and HTTP request metadata (used for API rate limiting, spam/abuse prevention, and security/consent audit logs).',
          'Request correlation IDs, user-agent headers, and optional session device identifier for active refresh-token management.',
          'Local app storage (AsyncStorage on your device) to persist your authenticated session tokens and selected interface language.',
        ],
      },
      {
        id: 'how-information-is-used',
        title: '8. How Information Is Used',
        paragraphs: [
          'We process collected information strictly for the following operational purposes:',
        ],
        bullets: [
          'Creating, moderating, and displaying your matrimonial profile to eligible opposite-gender members according to your privacy settings.',
          'Generating partner recommendations, preference alignment summaries, and 36-Guna Ashta-Koota Kundli compatibility calculations.',
          'Facilitating mutual-interest connections, real-time 1-on-1 chat (via authenticated WebSocket/REST channels), and mutual-consent contact disclosures.',
          'Coordinating Vedic Pandit ceremony bookings and online consultation sessions when requested by you.',
          'Verifying profile authenticity, reviewing abuse/fraud reports, enforcing membership entitlements, and complying with applicable Indian laws.',
        ],
      },
      {
        id: 'how-information-is-shared',
        title: '9. How Information Is Shared',
        paragraphs: [
          'We do not sell or rent your personal data to data brokers or third-party advertisers. Your information is shared only in the following contexts:',
        ],
        bullets: [
          'With Other Registered Members: Redacted profile details (First Name + Last Initial, age, height, religion/community, city, education, profession, bio, and photos governed by your photoPrivacy setting) are shown to eligible members. Your mobile number and email address remain locked by default and are disclosed to a match ONLY after mutual two-way contact exchange acceptance.',
          'With Certified Pandits: When you book a ceremony or consultation, booking details (and your Kundli details only if you grant kundliSharedConsent) are shared with the assigned Pandit.',
          'With Essential Infrastructure Processors: Google Firebase (authentication), MongoDB Atlas (cloud database), Cloudinary (media storage and signed image delivery), and Render (cloud API and static web hosting) solely to operate the platform.',
          'For Moderation, Safety & Legal Compliance: Authorized ShaadiBanao administrators/moderators review pending profiles, photos, verification submissions, and safety reports (with administrative actions logged in an audit trail), and we may disclose records when required by lawful order under applicable Indian statutes.',
        ],
      },
      {
        id: 'cloudinary-media-storage',
        title: '10. Cloudinary Media Storage',
        paragraphs: [
          'All uploaded photos and verification PDFs are validated for MIME type, file size, and binary magic bytes before streaming to Cloudinary over HTTPS (our server does not write new uploads to local server disk).',
          'New profile photos, identity verification documents, and Kundli charts are stored using Cloudinary authenticated delivery. Identity documents reside under a restricted private vault prefix and can only be viewed by the account owner or authorized verification staff via short-lived (10-minute) signed URLs, with every administrative view recorded in our audit log. Locked or blurred profile photos are served using server-signed blur transformations.',
        ],
      },
      {
        id: 'firebase-authentication',
        title: '11. Firebase Authentication & Google Sign-In',
        paragraphs: [
          'ShaadiBanao uses Google Firebase Authentication (@react-native-firebase/auth and firebase-admin) and Google Sign-In (@react-native-google-signin/google-signin) to verify Indian mobile numbers via SMS OTP and authenticate Google accounts.',
          'Firebase processes your phone number, Google OAuth token, email verification status, and device integrity signals (such as Google Play Services / Play Integrity checks during SMS OTP) in accordance with Google Privacy Terms, returning a cryptographically signed ID token verified by our backend.',
        ],
      },
      {
        id: 'mongodb-data-storage',
        title: '12. MongoDB Atlas Data Storage',
        paragraphs: [
          'Account records, matrimonial profiles, partner preferences, interests, chat messages, Kundli profiles, ceremony bookings, consent logs, support inquiries, and account deletion audit records are stored in MongoDB Atlas cloud databases accessed over TLS-encrypted connections.',
        ],
      },
      {
        id: 'data-security',
        title: '13. Data Security',
        paragraphs: [
          'We implement technical and organizational safeguards appropriate to the sensitivity of matrimonial data:',
        ],
        bullets: [
          'HTTPS/TLS encryption in transit; cleartext HTTP traffic is disabled in production Android builds.',
          'Cryptographic hashing of refresh tokens (SHA-256), OTP challenges (bcrypt), and administrative credentials (bcrypt); plaintext OTPs and passwords are never stored.',
          'HMAC-SHA256 signed upload intents with 15-minute expiry, binary file-header validation, Helmet HTTP security headers, and IP/account rate limiting.',
          'Role-based access controls and immutable audit logging for administrative moderation and private document review.',
          'Important Notice: While we enforce industry-standard security controls in transit and across our cloud infrastructure, no method of electronic transmission or storage over the internet can be guaranteed to be 100% immune from compromise.',
        ],
      },
      {
        id: 'data-retention',
        title: '14. Data Retention',
        paragraphs: [
          'Active account and profile information is retained for as long as your ShaadiBanao account remains active so we can provide matchmaking and booking services.',
          'Temporary verification OTP challenges expire automatically within 5 to 10 minutes via database Time-To-Live (TTL) indexes. Refresh tokens expire automatically after 7 days.',
          'When you delete your account, personal profile data, photos, private verification media, preferences, and Kundli data are deleted or anonymized immediately upon verified request completion, except for minimal anonymized audit records, abuse/safety reports, and ceremony/transaction records retained only as required under applicable Indian law (including the Information Technology Act, 2000 and Digital Personal Data Protection Act, 2023).',
        ],
      },
      {
        id: 'account-and-data-deletion',
        title: '15. Account & Data Deletion',
        paragraphs: [
          'You may permanently delete your ShaadiBanao account at any time through either of two official channels:',
        ],
        bullets: [
          'Inside the ShaadiBanao Android App: Navigate to Profile -> Privacy & Visibility Settings -> Delete Account Permanently and confirm deletion while signed in.',
          'On the Public Web Portal: Visit /delete-account on our official website, verify ownership of your registered mobile number or Google email, and submit your deletion request to receive a unique tracking Reference ID (DEL-YYYYMMDD-XXXXXX).',
          'Upon verified deletion: Your matrimonial profile, Cloudinary profile photos, private identity document files, Kundli record, partner preferences, shortlists, pending interests, community posts, and active sessions are permanently removed, and your core user record is anonymized.',
        ],
      },
      {
        id: 'childrens-privacy',
        title: "16. Children's Privacy & Age Restrictions",
        paragraphs: [
          'ShaadiBanao is strictly intended for adults aged 18 years and older seeking lawful matrimonial alliances (and in accordance with Indian statutory marriage age requirements: minimum 18 years for brides and 21 years for grooms under the Prohibition of Child Marriage Act, 2006).',
          'We do not knowingly permit registration by or collect personal information concerning anyone under 18 years of age. Profiles created by parents or guardians on behalf of a son, daughter, or relative must strictly represent an adult candidate meeting legal marriage age eligibility. Any underage profile identified by moderation is immediately removed.',
        ],
      },
      {
        id: 'user-rights',
        title: '17. Your Privacy Rights (DPDP Act, 2023)',
        paragraphs: [
          'Subject to applicable Indian law, including the Digital Personal Data Protection Act, 2023, you have the right to:',
        ],
        bullets: [
          'Access and review a summary of the personal data associated with your ShaadiBanao account.',
          'Correct, update, or complete inaccurate or outdated profile, preference, or Kundli details directly within the app.',
          'Control photo privacy, income-band visibility, and contact sharing consent.',
          'Withdraw consent and erase your account and personal data via in-app deletion or /delete-account.',
          'Register a grievance with our designated Grievance Officer using the contact channels below.',
        ],
      },
      {
        id: 'policy-updates',
        title: '18. Policy Updates & Material Re-Consent',
        paragraphs: [
          `This Privacy Policy carries version ${CURRENT_PRIVACY_POLICY_VERSION} and was last updated on ${POLICY_LAST_UPDATED}.`,
          'If we make material changes to how we collect, use, or share personal data, we increment the policy version, publish the updated policy at /privacy-policy, and prompt registered users inside the app to review and provide fresh auditable consent before continuing.',
        ],
      },
      {
        id: 'developer-contact',
        title: '19. Developer & Grievance Officer Contact Information',
        paragraphs: [
          'For privacy inquiries, data rights requests, or grievances under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the Digital Personal Data Protection Act, 2023, please contact:',
        ],
        bullets: [
          `Legal Entity / Publisher: ${developerContact.legalEntityName}`,
          `Customer & Privacy Support Email: ${developerContact.supportEmail}`,
          `Grievance Officer: ${developerContact.grievanceOfficerName}`,
          `Grievance Officer Email: ${developerContact.grievanceEmail}`,
          `Support Telephone: ${developerContact.supportPhone}`,
          `Registered Postal Address: ${developerContact.postalAddress}`,
        ],
      },
    ],
  };
}

export function buildTermsDocument(): PublicLegalDocument {
  const { contactPlaceholdersConfigured, developerContact } = getPublicDeveloperContact();

  return {
    documentType: 'terms_and_conditions',
    title: 'ShaadiBanao Terms & Conditions',
    version: CURRENT_TERMS_VERSION,
    effectiveDate: POLICY_LAST_UPDATED,
    lastUpdated: POLICY_LAST_UPDATED,
    appName: 'ShaadiBanao',
    tagline: 'Rishton ki nayi shuruaat',
    contactPlaceholdersConfigured,
    developerContact,
    sections: [
      {
        id: 'account-registration',
        title: '1. Account Registration & Acceptance of Terms',
        paragraphs: [
          'By registering an account, signing in, or using the ShaadiBanao Android application or official website, you agree to be bound by these Terms & Conditions and our Privacy Policy. Explicit consent via our unchecked registration agreement is mandatory before creating an account.',
          'You may register an account for yourself or, as an authorized parent, sibling, or relative, on behalf of an adult marriage candidate with their explicit knowledge and consent. Each candidate may maintain only one active matrimonial profile.',
        ],
      },
      {
        id: 'eligibility-age',
        title: '2. User Eligibility & Statutory Age Requirements',
        paragraphs: [
          'To register or be represented on ShaadiBanao, the user creating the account must be at least 18 years of age and legally competent to contract under the Indian Contract Act, 1872.',
          'In accordance with Indian matrimonial law, prospective brides must be at least 18 years of age and prospective grooms must be at least 21 years of age, and the candidate must be legally unmarried, divorced, or widowed (not currently in a subsisting marriage where prohibited by applicable law).',
        ],
      },
      {
        id: 'profile-authenticity',
        title: '3. Profile Authenticity & Moderation',
        paragraphs: [
          'You warrant that all information submitted in your profile—including name, date of birth, marital status, education, occupation, income band, family background, Kundli details, photos, and optional government ID verification details—is truthful, current, and accurate.',
          'All new profiles, uploaded photos, verification submissions, and community stories undergo moderation review. ShaadiBanao reserves the right to request clarifications, reject unverified or misleading media, or withhold profile approval.',
        ],
      },
      {
        id: 'acceptable-use',
        title: '4. Acceptable Use',
        paragraphs: [
          'ShaadiBanao is exclusively a serious matrimonial matchmaking and Vedic ceremony platform. It is NOT a casual dating, commercial solicitation, or mass-messaging service. You agree to interact respectfully with members and Pandits, honor member privacy boundaries, and keep personal contact details confidential when shared via mutual consent.',
        ],
      },
      {
        id: 'misuse-fraud',
        title: '5. Misuse, Harassment & Fraudulent Profiles',
        paragraphs: [
          'ShaadiBanao enforces zero tolerance against platform misuse. The following actions are strictly prohibited and result in immediate suspension or permanent ban:',
        ],
        bullets: [
          'Creating fake, impersonated, duplicate, or already-married profiles.',
          'Soliciting money, loans, gifts, financial transfers, or dowry (in strict compliance with the Dowry Prohibition Act, 1961).',
          'Harassment, abusive language, obscene content, non-consensual sharing of private photos/phone numbers, or stalking.',
          'Scraping member data, bypassing photo blur/privacy signatures, automating requests, or attempting unauthorized access.',
        ],
      },
      {
        id: 'user-responsibilities',
        title: '6. User Responsibilities & Independent Due Diligence',
        paragraphs: [
          'While ShaadiBanao performs phone/Google authentication, photo moderation, and optional masked ID verification, ShaadiBanao does not conduct comprehensive criminal, financial, or family background investigations on members.',
          'You and your family are solely responsible for conducting independent verification of a prospective match’s identity, marital status, career, family background, and compatibility before proceeding with meetings, ceremonies, or marriage decisions.',
        ],
      },
      {
        id: 'membership-payment-terms',
        title: '7. Membership Tiers & Payment Terms',
        paragraphs: [
          'ShaadiBanao offers tiered access: ShaadiBanao Free (₹0), ShaadiBanao Plus (₹2,999 for 3 Months), and ShaadiBanao Premium (₹4,999 for 6 Months), with female profiles enjoying complimentary discovery access as configured by platform policy.',
          'Paid tiers unlock entitlements such as initiating direct 1-on-1 chat, a defined limit of mutual-consent contact disclosures, profile spotlighting, and priority search placement. Subscriptions are never activated or auto-debited without explicit user confirmation through an officially configured payment gateway.',
        ],
      },
      {
        id: 'subscription-cancellation',
        title: '8. Subscription Cancellation & Refund Policy',
        paragraphs: [
          'ShaadiBanao memberships are fixed-duration plans with zero surprise recurring auto-debits. You may cancel your membership or delete your account at any time.',
          'Unless otherwise required under applicable Indian consumer protection laws or in cases of verified duplicate technical charges, fees paid for activated membership periods or completed Pandit consultations are non-refundable once entitlements (such as chat initiation or contact disclosures) have been utilized.',
        ],
      },
      {
        id: 'suspension-termination',
        title: '9. Account Suspension & Termination',
        paragraphs: [
          'ShaadiBanao moderators and administrators may issue warnings, request profile corrections, suspend, or permanently terminate any account that violates these Terms, triggers verified member safety reports, or poses a legal or security risk.',
          'You may terminate your account at any time via Profile -> Privacy & Visibility Settings -> Delete Account Permanently in the Android app or at /delete-account on our website.',
        ],
      },
      {
        id: 'limitation-of-liability',
        title: '10. Disclaimers & Limitation of Liability',
        paragraphs: [
          'ShaadiBanao acts as an online matchmaking intermediary platform and facilitator for optional Vedic Kundli and Pandit booking services. Astrological compatibility scores (36 Guna Milan) and Muhurat suggestions are traditional cultural computations provided for informational guidance without guarantee of marital outcome.',
          'To the fullest extent permitted under applicable Indian law, ShaadiBanao and its operators shall not be liable for indirect, incidental, or consequential damages, or for disputes, misrepresentations, or offline conduct between members or third-party service providers.',
        ],
      },
      {
        id: 'contact-details',
        title: '11. Governing Law, Grievance Redressal & Contact Details',
        paragraphs: [
          'These Terms are governed by the laws of India. For customer support, legal notices, or grievance redressal, please reach out via /contact or the official details below:',
        ],
        bullets: [
          `Legal Entity / Publisher: ${developerContact.legalEntityName}`,
          `Official Support Email: ${developerContact.supportEmail}`,
          `Grievance Officer: ${developerContact.grievanceOfficerName} (${developerContact.grievanceEmail})`,
          `Support Phone: ${developerContact.supportPhone}`,
          `Registered Address: ${developerContact.postalAddress}`,
        ],
      },
    ],
  };
}
