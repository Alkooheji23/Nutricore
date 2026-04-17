import Stripe from 'stripe';
import { storage } from './storage';
import { trackUserEvent } from './analytics';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY not configured. Please add your Stripe secret key.');
    }
    stripeClient = new Stripe(apiKey);
  }
  return stripeClient;
}

export const STRIPE_PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || '',
  yearly: process.env.STRIPE_PRICE_YEARLY || '',
};

export async function createCheckoutSession(
  userId: string,
  email: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const user = await storage.getUser(userId);
  
  let customerId = user?.stripeCustomerId;
  
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email,
      metadata: { userId },
    });
    customerId = customer.id;
    await storage.updateUserProfile(userId, { stripeCustomerId: customerId });
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 30,
      metadata: { userId },
    },
    metadata: { userId },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });

  return session.url || '';
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export async function handleWebhookEvent(
  payload: Buffer,
  signature: string
): Promise<{ success: boolean; message: string }> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return { success: false, message: 'Webhook secret not configured' };
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return { success: false, message: 'Invalid signature' };
  }

  console.log(`[Stripe] Received event: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      
      if (userId && session.subscription) {
        const subscription = await getStripe().subscriptions.retrieve(session.subscription as string);
        const priceId = subscription.items.data[0]?.price?.id;
        const periodEnd = (subscription as any).current_period_end;
        
        await storage.updateUserProfile(userId, {
          stripeSubscriptionId: session.subscription as string,
          stripePriceId: priceId,
          subscriptionType: 'paid',
          subscriptionStartDate: new Date(),
          subscriptionEndDate: periodEnd ? new Date(periodEnd * 1000) : null,
        });
        
        // Track subscription started event
        trackUserEvent('subscription_started', userId, 'premium');
        
        console.log(`[Stripe] User ${userId} subscription activated`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      
      if (userId) {
        const status = subscription.status;
        const periodEnd = (subscription as any).current_period_end;
        const endDate = periodEnd ? new Date(periodEnd * 1000) : null;
        
        await storage.updateUserProfile(userId, {
          subscriptionType: status === 'active' || status === 'trialing' ? 'paid' : 'expired',
          subscriptionEndDate: endDate,
        });
        
        // Track subscription renewal or expiration
        if (status === 'active') {
          trackUserEvent('subscription_renewed', userId, 'premium');
        } else if (status === 'canceled' || status === 'unpaid') {
          trackUserEvent('subscription_expired', userId, 'expired');
        }
        
        console.log(`[Stripe] User ${userId} subscription updated: ${status}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      
      if (userId) {
        await storage.updateUserProfile(userId, {
          subscriptionType: 'expired',
          stripeSubscriptionId: null,
        });
        
        // Track subscription cancelled event
        trackUserEvent('subscription_cancelled', userId, 'expired');
        
        console.log(`[Stripe] User ${userId} subscription cancelled`);
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`[Stripe] Payment succeeded for invoice ${invoice.id}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      
      console.log(`[Stripe] Payment failed for customer ${customerId}`);
      break;
    }

    default:
      console.log(`[Stripe] Unhandled event type: ${event.type}`);
  }

  return { success: true, message: 'Event processed' };
}
