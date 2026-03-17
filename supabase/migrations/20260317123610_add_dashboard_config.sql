ALTER TABLE profiles ADD COLUMN dashboard_config jsonb DEFAULT NULL;

COMMENT ON COLUMN profiles.dashboard_config IS 'Purpose-driven dashboard configuration: tabs, widgets, purpose. Set during onboarding.';
