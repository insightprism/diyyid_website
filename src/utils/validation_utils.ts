import { app_config } from '../config/app_config';

export interface ValidationResult {
  is_valid: boolean;
  error?: string;
}

export function validate_email(email: string): ValidationResult {
  const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email.trim()) {
    return { is_valid: false, error: 'Email is required' };
  }

  if (!email_regex.test(email)) {
    return { is_valid: false, error: 'Please enter a valid email address' };
  }

  return { is_valid: true };
}

export function validate_password(password: string): ValidationResult {
  if (!password) {
    return { is_valid: false, error: 'Password is required' };
  }

  if (password.length < 6) {
    return { is_valid: false, error: 'Password must be at least 6 characters' };
  }

  return { is_valid: true };
}

export function validate_phone(phone: string): ValidationResult {
  if (!phone.trim()) {
    return { is_valid: false, error: 'Phone number is required' };
  }

  // Remove spaces, dashes, parentheses for validation
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (!app_config.validation.phone_regex.test(cleaned)) {
    return { is_valid: false, error: 'Please enter a valid phone number' };
  }

  return { is_valid: true };
}

export function validate_display_name(name: string): ValidationResult {
  if (!name.trim()) {
    return { is_valid: false, error: 'Name is required' };
  }

  if (name.trim().length < 2) {
    return { is_valid: false, error: 'Name must be at least 2 characters' };
  }

  return { is_valid: true };
}

// Format phone to E.164 format
export function format_phone_e164(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // If doesn't start with +, assume US and add +1
  if (!cleaned.startsWith('+')) {
    return '+1' + cleaned;
  }

  return cleaned;
}
