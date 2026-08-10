export type PlanId = 'free' | 'maker';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
export type CheckoutRequest = {
  userId: string;
  planId: PlanId;
  returnUrl: string;
};
export type BillingSubscription = {
  provider: string;
  customerId: string;
  subscriptionId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd?: Date;
};
export interface BillingProvider {
  createCheckout(request: CheckoutRequest): Promise<{
    url: string;
  }>;
  createPortal(
    userId: string,
    returnUrl: string,
  ): Promise<{
    url: string;
  }>;
  verifyWebhook(payload: string, signature: string): Promise<BillingSubscription | undefined>;
}
export class DisabledBillingProvider implements BillingProvider {
  async createCheckout(): Promise<{
    url: string;
  }> {
    throw new Error('Billing is not configured yet.');
  }
  async createPortal(): Promise<{
    url: string;
  }> {
    throw new Error('Billing is not configured yet.');
  }
  async verifyWebhook(): Promise<BillingSubscription | undefined> {
    throw new Error('Billing is not configured yet.');
  }
}
