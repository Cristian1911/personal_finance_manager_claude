// supabase/functions/notify-bug-report/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const GITHUB_REPO = Deno.env.get("GITHUB_REPO")!; // e.g. "owner/repo"

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();

    if (!record?.id) {
      return new Response("Missing record.id", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate signed URL for attachment if present
    let screenshotMarkdown = "";
    if (record.attachment_path) {
      const { data: signedData } = await supabase.storage
        .from("bug-reports")
        .createSignedUrl(record.attachment_path, 3600);
      if (signedData?.signedUrl) {
        screenshotMarkdown = `\n\n![Screenshot](${signedData.signedUrl})`;
      }
    }

    const deviceContext = record.device_context
      ? `\n\n### Device Context\n\`\`\`json\n${JSON.stringify(record.device_context, null, 2)}\n\`\`\``
      : "";

    const body = [
      `## Bug Report`,
      ``,
      `**Description:** ${record.description ?? "_No description_"}`,
      ``,
      `**Route:** ${record.route_hint ?? "N/A"}`,
      `**Area:** ${record.selected_area_hint ?? "N/A"}`,
      `**Status:** ${record.status}`,
      `**Source:** ${record.source}`,
      deviceContext,
      screenshotMarkdown,
      ``,
      `---`,
      `*Reported via in-app capture — ID: \`${record.id}\`*`,
    ].join("\n");

    const issueRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: `[Bug] ${record.title}`,
        body,
        labels: ["bug", "in-app-report"],
      }),
    });

    if (!issueRes.ok) {
      const err = await issueRes.text();
      console.error("GitHub API error:", err);
      return new Response("GitHub API error", { status: 500 });
    }

    const issue = await issueRes.json();

    // Write back the issue URL to the bug_reports row
    await supabase
      .from("bug_reports")
      .update({ github_issue_url: issue.html_url })
      .eq("id", record.id);

    return new Response(JSON.stringify({ issue_url: issue.html_url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-bug-report error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
