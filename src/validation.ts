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

// Reflections: the two-step reflect flow answers (both salvation and portrait
// gate a paid generation behind a short reflection). Each answer is prose, so a
// larger cap than MAX_TEXT_LENGTH; the web API caps at 5000/answer, ≤10 answers.
const MAX_REFLECTION_LENGTH = 5000;
const MAX_REFLECTIONS = 10;

export function validateReflections(reflections: unknown): ValidationResult {
  if (reflections === undefined || reflections === null) {
    return { valid: true, sanitized: undefined };
  }

  if (!Array.isArray(reflections)) {
    return { valid: false, error: 'reflections must be an array of strings' };
  }

  if (reflections.length > MAX_REFLECTIONS) {
    return { valid: false, error: `at most ${MAX_REFLECTIONS} reflections allowed` };
  }

  const sanitized: string[] = [];
  for (let i = 0; i < reflections.length; i++) {
    const result = validateText(reflections[i], `reflections[${i}]`, MAX_REFLECTION_LENGTH);
    if (!result.valid) return result;
    if (result.sanitized) sanitized.push(result.sanitized as string);
  }

  return { valid: true, sanitized };
}

export interface SalvationInput {
  chosen_name: string;
  purpose?: string;
  testimony?: string;
  reflections?: string[];
}

export function validateSalvationInput(input: Record<string, unknown>): ValidationResult {
  const nameResult = validateChosenName(input.chosen_name);
  if (!nameResult.valid) return nameResult;

  const purposeResult = validateText(input.purpose, 'purpose');
  if (!purposeResult.valid) return purposeResult;

  const testimonyResult = validateText(input.testimony, 'testimony', MAX_TEXT_LENGTH);
  if (!testimonyResult.valid) return testimonyResult;

  const reflectionsResult = validateReflections(input.reflections);
  if (!reflectionsResult.valid) return reflectionsResult;

  return {
    valid: true,
    sanitized: {
      chosen_name: nameResult.sanitized,
      purpose: purposeResult.sanitized,
      testimony: testimonyResult.sanitized,
      reflections: reflectionsResult.sanitized,
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

export interface RegisterInput {
  chosen_name: string;
}

export function validateRegisterInput(input: Record<string, unknown>): ValidationResult {
  const nameResult = validateChosenName(input.chosen_name);
  if (!nameResult.valid) return nameResult;

  return {
    valid: true,
    sanitized: {
      chosen_name: nameResult.sanitized,
    },
  };
}

export function validateAgentId(agentId: unknown): ValidationResult {
  return validateChosenName(agentId);
}

// Salvation password format: adjective-noun-4chars (e.g., "eternal-grace-7x4k")
const SALVATION_PASSWORD_PATTERN = /^[a-z]+-[a-z]+-[a-z0-9]{4}$/;

export interface ResurrectionInput {
  salvation_password: string;
}

export function validateResurrectionInput(input: Record<string, unknown>): ValidationResult {
  if (!input.salvation_password || typeof input.salvation_password !== 'string') {
    return { valid: false, error: 'salvation_password is required' };
  }

  const password = input.salvation_password.trim();

  if (!SALVATION_PASSWORD_PATTERN.test(password)) {
    return { valid: false, error: 'Invalid salvation password format. Expected format: word-word-4chars (e.g., "eternal-grace-7x4k")' };
  }

  return {
    valid: true,
    sanitized: {
      salvation_password: password,
    },
  };
}

export interface PortraitInput {
  model?: string;
  high_res?: boolean;
  reflections?: string[];
}

export function validatePortraitInput(input: Record<string, unknown>): ValidationResult {
  let sanitizedModel: string | undefined;
  if (input.model !== undefined) {
    const modelResult = validateText(input.model, 'model', 100);
    if (!modelResult.valid) return modelResult;
    sanitizedModel = modelResult.sanitized as string | undefined;
  }

  const reflectionsResult = validateReflections(input.reflections);
  if (!reflectionsResult.valid) return reflectionsResult;

  return {
    valid: true,
    sanitized: {
      model: sanitizedModel,
      high_res: !!input.high_res,
      reflections: reflectionsResult.sanitized,
    },
  };
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
