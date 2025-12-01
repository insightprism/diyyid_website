// Application configuration
// All configurable values should be defined here

export const app_config = {
  app_name: 'HomePro Assist',

  // Session settings
  session: {
    default_price_cents: 4999,  // $49.99
    max_duration_minutes: 60,
  },

  // Request categories with base prices in cents
  categories: [
    { value: 'plumbing', label: 'Plumbing', icon: '🚿', base_price: 4999 },
    { value: 'electrical', label: 'Electrical', icon: '⚡', base_price: 4999 },
    { value: 'hvac', label: 'HVAC', icon: '❄️', base_price: 5999 },
    { value: 'appliance', label: 'Appliance', icon: '🔧', base_price: 3999 },
    { value: 'other', label: 'Other', icon: '🏠', base_price: 3999 },
  ] as const,

  // Photo upload limits
  photos: {
    max_count: 5,
    max_size_mb: 10,
    allowed_types: ['image/jpeg', 'image/png', 'image/webp'],
  },

  // Validation
  validation: {
    description_min_length: 20,
    description_max_length: 1000,
    max_photos: 5,
    phone_regex: /^\+?[1-9]\d{9,14}$/,
  },
};

export type CategoryValue = typeof app_config.categories[number]['value'];
