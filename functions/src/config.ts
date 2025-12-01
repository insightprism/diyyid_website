import * as functions from 'firebase-functions';

interface AppConfig {
  stripe: {
    secret_key: string;
    webhook_secret: string;
  };
  zoho: {
    client_id: string;
    client_secret: string;
    refresh_token: string;
    org_id: string;
  };
  twilio: {
    account_sid: string;
    auth_token: string;
    phone_number: string;
  };
  app: {
    base_url: string;
  };
}

function get_config(): AppConfig {
  const config = functions.config();

  return {
    stripe: {
      secret_key: config.stripe?.secret_key || process.env.STRIPE_SECRET_KEY || '',
      webhook_secret: config.stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    zoho: {
      client_id: config.zoho?.client_id || process.env.ZOHO_CLIENT_ID || '',
      client_secret: config.zoho?.client_secret || process.env.ZOHO_CLIENT_SECRET || '',
      refresh_token: config.zoho?.refresh_token || process.env.ZOHO_REFRESH_TOKEN || '',
      org_id: config.zoho?.org_id || process.env.ZOHO_ORG_ID || '',
    },
    twilio: {
      account_sid: config.twilio?.account_sid || process.env.TWILIO_ACCOUNT_SID || '',
      auth_token: config.twilio?.auth_token || process.env.TWILIO_AUTH_TOKEN || '',
      phone_number: config.twilio?.phone_number || process.env.TWILIO_PHONE_NUMBER || '',
    },
    app: {
      base_url: config.app?.base_url || process.env.APP_BASE_URL || 'http://localhost:5173',
    },
  };
}

export const app_config = get_config();
