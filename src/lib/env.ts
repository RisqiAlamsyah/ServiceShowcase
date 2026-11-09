import "server-only";
import { parseServerEnv } from "@/lib/env.schema";

// Satu-satunya pembaca process.env untuk nilai server (RULES_SECURITY §1.3).
export const serverEnv = parseServerEnv(process.env);
