import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ANNOTATIONS_DIR = join(__dirname, "../../annotations");
export const PROJECT_ROOT = join(__dirname, "../../../..");
