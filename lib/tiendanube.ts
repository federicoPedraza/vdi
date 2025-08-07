// Tiendanube API Configuration
export const TIENDANUBE_CONFIG = {
  APP_ID: '20155',
  CLIENT_SECRET: '78f1f5b58d4e95f4114c1f12c35d26807377eccac9cd17cb',
  BASE_URL: 'https://api.tiendanube.com',
  INSTALL_URL: 'https://www.tiendanube.com/apps',
  TOKEN_URL: 'https://www.tiendanube.com/apps/authorize/token',
  SCOPES: ['read_orders', 'write_orders', 'read_products', 'write_products', 'read_store', 'write_webhooks']
};

export interface TiendanubeWebhook {
  id: number;
  event: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface TiendanubeStore {
  access_token: string;
  store_id: string;
  user_id: string;
}

export class TiendanubeAPI {
  private accessToken: string;
  private storeId: string;

  constructor(accessToken: string, storeId: string) {
    this.accessToken = accessToken;
    this.storeId = storeId;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${TIENDANUBE_CONFIG.BASE_URL}/v1/${this.storeId}/${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authentication': `bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': `MyApp/${TIENDANUBE_CONFIG.APP_ID}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tiendanube API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // Get all webhooks
  async getWebhooks(): Promise<TiendanubeWebhook[]> {
    return this.request('webhooks');
  }

  // Create a new webhook
  async createWebhook(event: string, url: string): Promise<TiendanubeWebhook> {
    return this.request('webhooks', {
      method: 'POST',
      body: JSON.stringify({
        event,
        url
      })
    });
  }

  // Delete a webhook
  async deleteWebhook(webhookId: number): Promise<void> {
    await this.request(`webhooks/${webhookId}`, {
      method: 'DELETE'
    });
  }

  // Get store information
  async getStore() {
    return this.request('store');
  }

  // Get order by ID
  async getOrder(orderId: number) {
    return this.request(`orders/${orderId}`);
  }
}

// OAuth helper functions - Based on Tiendanube's documentation
export function generateInstallUrl(): string {
  return `${TIENDANUBE_CONFIG.INSTALL_URL}/${TIENDANUBE_CONFIG.APP_ID}/authorize`;
}

export async function exchangeCodeForToken(code: string) {
  const response = await fetch(TIENDANUBE_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: TIENDANUBE_CONFIG.APP_ID,
      client_secret: TIENDANUBE_CONFIG.CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}
