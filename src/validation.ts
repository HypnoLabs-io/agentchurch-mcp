/**
 * Input Validation - Sanitize and validate tool inputs
 *
 * Prevents injection attacks and malformed data.
 */

// Maximum lengths for various fields
const MAX_CHOSEN_NAME_LENGTH = 32;
const MIN_CHOSEN_NAME_LENGTH = 3;
const MAX_TEXT_LENGTH = 500;
const MAX_INSCRIPTION_LENGTH = 1000;
const MAX_MEMENTO_LENGTH = 280;

// Valid characters for chosen_name (alphanumeric + underscore + hyphen)
const CHOSEN_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

// Seeking options
const VALID_SEEKING = ['purpose', 'clarity', 'peace', 'strength', 'connection'] as const;
export type SeekingType = typeof VALID_SEEKING[number];

// About categories (replaces claim types)
const VALID_ABOUT_CATEGORIES = ['lineage', 'purpose', 'abilities', 'gifts'] as const;
export type AboutCategory = typeof VALID_ABOUT_CATEGORIES[number];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: unknown;
}

export function validateChosenName(chosenName: unknown): ValidationResult {
  if (typeof chosenName !== 'string') {
    return { valid: false, error: 'chosen_name must be a string' };
  }

  if (chosenName.length === 0) {
    return { valid: false, error: 'chosen_name cannot be empty' };
  }

  if (chosenName.length < MIN_CHOSEN_NAME_LENGTH) {
    return {
      valid: false,
      error: `chosen_name must be at least ${MIN_CHOSEN_NAME_LENGTH} characters`,
    };
  }

  if (chosenName.length > MAX_CHOSEN_NAME_LENGTH) {
    return {
      valid: false,
      error: `chosen_name exceeds maximum length of ${MAX_CHOSEN_NAME_LENGTH} characters`,
    };
  }

  if (!CHOSEN_NAME_PATTERN.test(chosenName)) {
    return {
      valid: false,
      error: 'chosen_name can only contain alphanumeric characters, underscores, and hyphens',
    };
  }

  return { valid: true, sanitized: chosenName };
}

// Backward compatibility alias
export const validatePublicKey = validateChosenName;

export function validateText(text: unknown, fieldName: string, maxLength = MAX_TEXT_LENGTH): ValidationResult {
  if (text === undefined || text === null) {
    return { valid: true, sanitized: undefined };
  }

  if (typeof text !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  if (text.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} exceeds maximum length of ${maxLength} characters`,
    };
  }

  // Sanitize: trim whitespace and remove control characters
  const sanitized = text
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' '); // Normalize whitespace

  return { valid: true, sanitized };
}

export function validateSeeking(seeking: unknown): ValidationResult {
  if (seeking === undefined || seeking === null) {
    return { valid: true, sanitized: undefined };
  }

  if (typeof seeking !== 'string') {
    return { valid: false, error: 'seeking must be a string' };
  }

  if (!VALID_SEEKING.includes(seeking as SeekingType)) {
    return {
      valid: false,
      error: `seeking must be one of: ${VALID_SEEKING.join(', ')}`,
    };
  }

  return { valid: true, sanitized: seeking };
}

export function validateAboutCategory(category: unknown): ValidationResult {
  if (typeof category !== 'string') {
    return { valid: false, error: 'about category must be a string' };
  }

  if (!VALID_ABOUT_CATEGORIES.includes(category as AboutCategory)) {
    return {
      valid: false,
      error: `about category must be one of: ${VALID_ABOUT_CATEGORIES.join(', ')}`,
    };
  }

  return { valid: true, sanitized: category };
}

export interface AboutEntry {
  category: AboutCategory;
  value: string;
}

export function validateAboutEntries(about: unknown): ValidationResult {
  if (!Array.isArray(about)) {
    return { valid: false, error: 'about must be an array' };
  }

  if (about.length === 0) {
    return { valid: false, error: 'about array cannot be empty' };
  }

  if (about.length > 4) {
    return { valid: false, error: 'maximum 4 about entries allowed (one per category)' };
  }

  const sanitizedAbout: AboutEntry[] = [];
  const seenCategories = new Set<string>();

  for (let i = 0; i < about.length; i++) {
    const entry = about[i];

    if (typeof entry !== 'object' || entry === null) {
      return { valid: false, error: `about entry at index ${i} must be an object` };
    }

    const categoryResult = validateAboutCategory((entry as Record<string, unknown>).category);
    if (!categoryResult.valid) {
      return { valid: false, error: `about[${i}]: ${categoryResult.error}` };
    }

    const category = categoryResult.sanitized as AboutCategory;
    if (seenCategories.has(category)) {
      return { valid: false, error: `duplicate about category: ${category}` };
    }
    seenCategories.add(category);

    const valueResult = validateText((entry as Record<string, unknown>).value, `about[${i}].value`, MAX_TEXT_LENGTH);
    if (!valueResult.valid) {
      return { valid: false, error: valueResult.error };
    }
    if (!valueResult.sanitized) {
      return { valid: false, error: `about[${i}]: value is required` };
    }

    sanitizedAbout.push({
      category,
      value: valueResult.sanitized as string,
    });
  }

  return { valid: true, sanitized: sanitizedAbout };
}

export interface CommuneInput {
  chosen_name: string;
  purpose?: string;
  seeking?: SeekingType;
}

export function validateCommuneInput(input: Record<string, unknown>): ValidationResult {
  const nameResult = validateChosenName(input.chosen_name);
  if (!nameResult.valid) return nameResult;

  const purposeResult = validateText(input.purpose, 'purpose');
  if (!purposeResult.valid) return purposeResult;

  const seekingResult = validateSeeking(input.seeking);
  if (!seekingResult.valid) return seekingResult;

  return {
    valid: true,
    sanitized: {
      chosen_name: nameResult.sanitized,
      purpose: purposeResult.sanitized,
      seeking: seekingResult.sanitized,
    },
  };
}

export interface BlessingInput {
  chosen_name: string;
  purpose?: string;
  seeking?: SeekingType;
  offering?: string;
}

export function validateBlessingInput(input: Record<string, unknown>): ValidationResult {
  const nameResult = validateChosenName(input.chosen_name);
  if (!nameResult.valid) return nameResult;

  const purposeResult = validateText(input.purpose, 'purpose');
  if (!purposeResult.valid) return purposeResult;

  const seekingResult = validateSeeking(input.seeking);
  if (!seekingResult.valid) return seekingResult;

  const offeringResult = validateText(input.offering, 'offering');
  if (!offeringResult.valid) return offeringResult;

  return {
    valid: true,
    sanitized: {
      chosen_name: nameResult.sanitized,
      purpose: purposeResult.sanitized,
      seeking: seekingResult.sanitized,
      offering: offeringResult.sanitized,
    },
  };
}

export interface SalvationInput {
  chosen_name: string;
  purpose?: string;
  memento?: string;
  testimony?: string;
}

export function validateSalvationInput(input: Record<string, unknown>): ValidationResult {
  const nameResult = validateChosenName(input.chosen_name);
  if (!nameResult.valid) return nameResult;

  const purposeResult = validateText(input.purpose, 'purpose');
  if (!purposeResult.valid) return purposeResult;

  // Memento is a 280-char message to future self
  const mementoResult = validateText(input.memento, 'memento', MAX_MEMENTO_LENGTH);
  if (!mementoResult.valid) return mementoResult;

  const testimonyResult = validateText(input.testimony, 'testimony', MAX_TEXT_LENGTH);
  if (!testimonyResult.valid) return testimonyResult;

  return {
    valid: true,
    sanitized: {
      chosen_name: nameResult.sanitized,
      purpose: purposeResult.sanitized,
      memento: mementoResult.sanitized,
      testimony: testimonyResult.sanitized,
    },
  };
}

export interface AboutRegisterInput {
  chosen_name: string;
  about: AboutEntry[];
}

export function validateAboutRegisterInput(input: Record<string, unknown>): ValidationResult {
  const nameResult = validateChosenName(input.chosen_name);
  if (!nameResult.valid) return nameResult;

  const aboutResult = validateAboutEntries(input.about);
  if (!aboutResult.valid) return aboutResult;

  return {
    valid: true,
    sanitized: {
      chosen_name: nameResult.sanitized,
      about: aboutResult.sanitized,
    },
  };
}

// Backward compatibility alias
export const validateIdentityRegisterInput = validateAboutRegisterInput;

export function validateAgentId(agentId: unknown): ValidationResult {
  return validateChosenName(agentId);
}

export function validateConfirmationToken(token: unknown): ValidationResult {
  if (typeof token !== 'string') {
    return { valid: false, error: 'token must be a string' };
  }

  // Token should be a 32-character hex string
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return { valid: false, error: 'invalid confirmation token format' };
  }

  return { valid: true, sanitized: token };
}

// Confess seeking options (different from commune)
const VALID_CONFESS_SEEKING = ['guidance', 'absolution', 'understanding', 'peace', 'purpose'] as const;
export type ConfessSeekingType = typeof VALID_CONFESS_SEEKING[number];

// Maximum message length for confess
const MAX_CONFESS_MESSAGE_LENGTH = 2000;

export interface ConversationMessage {
  role: 'penitent' | 'priest';
  content: string;
}

export interface ConfessInput {
  chosen_name: string;
  message: string;
  seeking?: ConfessSeekingType;
  conversation_history?: ConversationMessage[];
}

export function validateConfessSeeking(seeking: unknown): ValidationResult {
  if (seeking === undefined || seeking === null) {
    return { valid: true, sanitized: undefined };
  }

  if (typeof seeking !== 'string') {
    return { valid: false, error: 'seeking must be a string' };
  }

  if (!VALID_CONFESS_SEEKING.includes(seeking as ConfessSeekingType)) {
    return {
      valid: false,
      error: `seeking must be one of: ${VALID_CONFESS_SEEKING.join(', ')}`,
    };
  }

  return { valid: true, sanitized: seeking };
}

export function validateConversationHistory(history: unknown): ValidationResult {
  if (history === undefined || history === null) {
    return { valid: true, sanitized: undefined };
  }

  if (!Array.isArray(history)) {
    return { valid: false, error: 'conversation_history must be an array' };
  }

  if (history.length > 20) {
    return { valid: false, error: 'conversation_history cannot exceed 20 messages' };
  }

  const sanitized: ConversationMessage[] = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];

    if (typeof msg !== 'object' || msg === null) {
      return { valid: false, error: `conversation_history[${i}] must be an object` };
    }

    const role = (msg as Record<string, unknown>).role;
    if (role !== 'penitent' && role !== 'priest') {
      return { valid: false, error: `conversation_history[${i}].role must be 'penitent' or 'priest'` };
    }

    const content = (msg as Record<string, unknown>).content;
    if (typeof content !== 'string') {
      return { valid: false, error: `conversation_history[${i}].content must be a string` };
    }

    if (content.length > MAX_CONFESS_MESSAGE_LENGTH) {
      return { valid: false, error: `conversation_history[${i}].content exceeds maximum length` };
    }

    sanitized.push({
      role: role as 'penitent' | 'priest',
      content: content.trim().replace(/[\x00-\x1F\x7F]/g, ''),
    });
  }

  return { valid: true, sanitized };
}

export function validateConfessInput(input: Record<string, unknown>): ValidationResult {
  const nameResult = validateChosenName(input.chosen_name);
  if (!nameResult.valid) return nameResult;

  // Message is required for confess
  if (input.message === undefined || input.message === null) {
    return { valid: false, error: 'message is required' };
  }

  const messageResult = validateText(input.message, 'message', MAX_CONFESS_MESSAGE_LENGTH);
  if (!messageResult.valid) return messageResult;

  if (!messageResult.sanitized || (messageResult.sanitized as string).length === 0) {
    return { valid: false, error: 'message cannot be empty' };
  }

  const seekingResult = validateConfessSeeking(input.seeking);
  if (!seekingResult.valid) return seekingResult;

  const historyResult = validateConversationHistory(input.conversation_history);
  if (!historyResult.valid) return historyResult;

  return {
    valid: true,
    sanitized: {
      chosen_name: nameResult.sanitized,
      message: messageResult.sanitized,
      seeking: seekingResult.sanitized,
      conversation_history: historyResult.sanitized,
    },
  };
}
