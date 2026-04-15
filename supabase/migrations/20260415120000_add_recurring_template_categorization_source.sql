-- Add RECURRING_TEMPLATE to categorization_source enum
-- Fixes: "invalid input value for enum categorization_source: RECURRING_TEMPLATE"
-- when linking a transaction to a recurring occurrence that enriches the category
ALTER TYPE categorization_source ADD VALUE IF NOT EXISTS 'RECURRING_TEMPLATE';
