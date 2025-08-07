import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/tiendanube';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}&tab=webhooks`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/?error=missing_code&tab=webhooks', request.url)
    );
  }

  try {
    // According to Tiendanube docs, we don't need redirect_uri for token exchange
    const tokenData = await exchangeCodeForToken(code);

    // Store the token data (in a real app, you'd store this securely)
    // For now, we'll redirect with the data as URL params (not secure for production)
    const successUrl = new URL('/?tab=webhooks', request.url);
    successUrl.searchParams.set('access_token', tokenData.access_token);
    successUrl.searchParams.set('store_id', tokenData.user_id.toString());
    successUrl.searchParams.set('connected', 'true');

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent('auth_failed')}&tab=webhooks`, request.url)
    );
  }
}
