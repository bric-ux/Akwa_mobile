/**
 * Types pour la location mensuelle et l'abonnement propriétaire.
 * N'impacte pas le flux court séjour existant.
 */

export type MonthlySubscriptionStatus = 'active' | 'suspended' | 'expired' | 'cancelled';
export type MonthlySubscriptionPlanType = 'single' | 'multi_2_5' | 'multi_6_plus';

export interface MonthlyRentalSubscription {
  id: string;
  host_id: string;
  property_id: string;
  status: MonthlySubscriptionStatus;
  plan_type: MonthlySubscriptionPlanType;
  monthly_price: number;
  start_date: string;
  end_date: string | null;
  next_billing_date: string;
  auto_renew: boolean;
  trial_end_date: string | null;
  created_at: string;
  updated_at: string;
  /** Jointure optionnelle */
  property?: { id: string; title: string };
}

export interface MonthlyRentalSubscriptionInsert {
  host_id: string;
  property_id: string;
  plan_type: MonthlySubscriptionPlanType;
  monthly_price: number;
  start_date: string;
  next_billing_date: string;
  auto_renew?: boolean;
}
