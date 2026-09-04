'use server';

import { headers } from 'next/headers';
import { and, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { issueReports } from '@/db/schema';
import { notifyOperator } from '@/lib/notify';
import { getSession } from '@/lib/session';

export type ReportState = { done?: boolean; error?: 'empty' | 'tooMany' | 'generic' };

const MAX_BODY = 1000;
const MAX_PER_HOUR_PER_IP = 5;

/**
 * "Something in the app is broken."
 *
 * Deliberately separate from flagging a listing: that is about a request being
 * abusive, this is about the software failing someone. With no support channel
 * and no staff, a broken screen otherwise just loses that person in silence.
 *
 * The page they were on is captured automatically, because people describe
 * problems as "the button didn't work" and the location is what makes that
 * actionable.
 */
export async function reportIssue(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const body = String(formData.get('body') ?? '').trim();
  const contact = String(formData.get('contact') ?? '').trim();
  const pagePath = String(formData.get('pagePath') ?? '').slice(0, 300);

  if (!body) return { error: 'empty' };

  try {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

    if (ip) {
      const [{ recent }] = await db
        .select({ recent: sql<number>`count(*)::int` })
        .from(issueReports)
        .where(
          and(
            sql`${issueReports.ip} = ${ip}`,
            gt(issueReports.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
          ),
        );

      if (Number(recent) >= MAX_PER_HOUR_PER_IP) return { error: 'tooMany' };
    }

    const session = await getSession();

    await db.insert(issueReports).values({
      body: body.slice(0, MAX_BODY),
      contact: contact.slice(0, 120) || null,
      pagePath: pagePath || null,
      personId: session?.personId ?? null,
      userAgent: h.get('user-agent')?.slice(0, 300) ?? null,
      ip,
    });

    // Push it to the operator immediately. Awaited so a failure is logged,
    // but notifyOperator never throws.
    await notifyOperator(
      [
        '⚠️ Problem reported',
        body.slice(0, 500),
        pagePath ? `Page: ${pagePath}` : null,
        contact ? `Contact: ${contact}` : null,
      ]
        .filter(Boolean)
        .join(String.fromCharCode(10)),
    );

    return { done: true };
  } catch (err) {
    // Never surface a crash here: someone reporting a problem should not be
    // met with a second one.
    console.error('[report] could not save issue report', err);
    return { error: 'generic' };
  }
}
