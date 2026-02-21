-- Add onboarding survey fields to profiles table
ALTER TABLE profiles
ADD COLUMN app_purpose text,
ADD COLUMN estimated_monthly_income numeric,
ADD COLUMN estimated_monthly_expenses numeric;
