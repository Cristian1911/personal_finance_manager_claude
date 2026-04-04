import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  getPendingReviewsSchema,
  getPendingReviewsDescription,
  getPendingReviewsHandler,
} from "./tools/get-pending-reviews.js";
import {
  getAnnotationSchema,
  getAnnotationDescription,
  getAnnotationHandler,
} from "./tools/get-annotation.js";
import {
  resolveReviewSchema,
  resolveReviewDescription,
  resolveReviewHandler,
} from "./tools/resolve-review.js";
import {
  getDesignTokensSchema,
  getDesignTokensDescription,
  getDesignTokensHandler,
} from "./tools/get-design-tokens.js";
import {
  createReviewSchema,
  createReviewDescription,
  createReviewHandler,
} from "./tools/create-review.js";

const server = new McpServer({
  name: "ui-pal",
  version: "0.1.0",
});

server.tool(
  "get_pending_reviews",
  getPendingReviewsDescription,
  getPendingReviewsSchema,
  getPendingReviewsHandler
);

server.tool(
  "get_annotation",
  getAnnotationDescription,
  getAnnotationSchema,
  getAnnotationHandler
);

server.tool(
  "resolve_review",
  resolveReviewDescription,
  resolveReviewSchema,
  resolveReviewHandler
);

server.tool(
  "get_design_tokens",
  getDesignTokensDescription,
  getDesignTokensSchema,
  getDesignTokensHandler
);

server.tool(
  "create_review",
  createReviewDescription,
  createReviewSchema,
  createReviewHandler
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
