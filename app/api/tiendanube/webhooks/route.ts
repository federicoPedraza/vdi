import { NextRequest, NextResponse } from 'next/server';
import { TiendanubeAPI } from '@/lib/tiendanube';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get('access_token');
  const storeId = searchParams.get('store_id');

  if (!accessToken || !storeId) {
    return NextResponse.json(
      { error: 'Missing access_token or store_id' },
      { status: 400 }
    );
  }

  try {
    const api = new TiendanubeAPI(accessToken, storeId);
    const webhooks = await api.getWebhooks();

    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, storeId, event, url } = body;

    if (!accessToken || !storeId || !event || !url) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const api = new TiendanubeAPI(accessToken, storeId);
    const webhook = await api.createWebhook(event, url);

    return NextResponse.json({ webhook });
  } catch (error) {
    console.error('Error creating webhook:', error);

    // Handle specific error messages from Tiendanube
    if (error instanceof Error) {
      const errorMessage = error.message;
      if (errorMessage.includes('Missing a required scope')) {
        return NextResponse.json(
          { error: 'Missing required scope. Please ensure your Tiendanube app has "write_webhooks" permission.' },
          { status: 403 }
        );
      }
      if (errorMessage.includes('422')) {
        return NextResponse.json(
          { error: 'Validation error: Invalid webhook data provided.' },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, storeId, webhookId } = body;

    if (!accessToken || !storeId || !webhookId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const api = new TiendanubeAPI(accessToken, storeId);
    await api.deleteWebhook(webhookId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}
