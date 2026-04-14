-- Add ONCE frequency for one-time planned payments
ALTER TYPE recurrence_frequency ADD VALUE IF NOT EXISTS 'ONCE';
