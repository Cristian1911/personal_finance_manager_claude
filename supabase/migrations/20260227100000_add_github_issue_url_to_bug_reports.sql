-- Add github_issue_url column to store the URL of the created GitHub issue
ALTER TABLE bug_reports
  ADD COLUMN IF NOT EXISTS github_issue_url text;
