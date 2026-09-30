import { useAuth } from "../auth";

/** Owner of v2 data before sign-in (debug builds and the web preview). */
export const V2_LOCAL_USER = "00000000-0000-4000-8000-000000000001";

/** The user whose v2 data the screens read and write. */
export function useV2UserId(): string {
  return useAuth().userId ?? V2_LOCAL_USER;
}
