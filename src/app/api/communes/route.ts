import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { communes, wilayas } from '@/db/schema';

/**
 * Communes for one wilaya.
 *
 * Deliberately not bundled into the page: the full national list is ~1,540
 * rows, and shipping that to every phone on a metered 3G connection would
 * blow the page budget many times over.
 */
export async function GET(request: Request) {
  const wilayaCode = new URL(request.url).searchParams.get('wilaya');
  if (!wilayaCode) return NextResponse.json({ communes: [] });

  const rows = await db
    .select({
      id: communes.id,
      nameAr: communes.nameAr,
      nameFr: communes.nameFr,
    })
    .from(communes)
    .innerJoin(wilayas, eq(wilayas.id, communes.wilayaId))
    .where(eq(wilayas.code, wilayaCode))
    .orderBy(asc(communes.nameFr));

  return NextResponse.json(
    { communes: rows },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
