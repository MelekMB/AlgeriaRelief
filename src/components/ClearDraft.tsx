'use client';

import { useEffect } from 'react';

/**
 * Wipes the saved form once the request is actually published.
 *
 * Without this, reopening the app showed the previous request pre-filled,
 * which is confusing at best and a privacy problem on a shared phone.
 */
export default function ClearDraft() {
  useEffect(() => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('ar_request_draft')) localStorage.removeItem(key);
      }
    } catch {
      /* storage unavailable - nothing to clear */
    }
  }, []);

  return null;
}
