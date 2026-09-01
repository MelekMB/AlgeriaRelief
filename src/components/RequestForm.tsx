'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitRequest, type SubmitState } from '@/app/[locale]/request/new/actions';

type Option = { code: string; label: string };
type Commune = { id: number; nameAr: string; nameFr: string };

const DRAFT_KEY = 'ar_request_draft_v1';

export default function RequestForm({
  locale,
  categories,
  wilayas,
}: {
  locale: string;
  categories: Option[];
  wilayas: Option[];
}) {
  const t = useTranslations('form');
  const tc = useTranslations('common');
  const te = useTranslations('formErrors');
  const tu = useTranslations('urgency');
  const tb = useTranslations('beneficiary');

  const [state, formAction, pending] = useActionState<SubmitState, FormData>(submitRequest, {});

  const [categoryCode, setCategoryCode] = useState('');
  const [wilayaCode, setWilayaCode] = useState('');
  const [communeId, setCommuneId] = useState('');
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [body, setBody] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [beneficiary, setBeneficiary] = useState('self');
  const [deliveryPoint, setDeliveryPoint] = useState<'home' | 'landmark'>('landmark');
  const [address, setAddress] = useState('');
  const [landmarkHint, setLandmarkHint] = useState('');
  const [showMore, setShowMore] = useState(false);

  // A dropped connection mid-form is normal here, not an edge case. Everything
  // except the phone number is kept locally so nothing is retyped.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const d = JSON.parse(saved);
      setCategoryCode(d.categoryCode ?? '');
      setWilayaCode(d.wilayaCode ?? '');
      setCommuneId(d.communeId ?? '');
      setBody(d.body ?? '');
      setUrgency(d.urgency ?? 'normal');
      setBeneficiary(d.beneficiary ?? 'self');
      setDeliveryPoint(d.deliveryPoint ?? 'landmark');
      setAddress(d.address ?? '');
      setLandmarkHint(d.landmarkHint ?? '');
    } catch {
      /* storage unavailable (private window, blocked cookies) — ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          categoryCode,
          wilayaCode,
          communeId,
          body,
          urgency,
          beneficiary,
          deliveryPoint,
          address,
          landmarkHint,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [categoryCode, wilayaCode, communeId, body, urgency, beneficiary, deliveryPoint, address, landmarkHint]);

  useEffect(() => {
    if (!wilayaCode) {
      setCommunes([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/communes?wilaya=${encodeURIComponent(wilayaCode)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCommunes(d.communes ?? []);
      })
      .catch(() => {
        if (!cancelled) setCommunes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [wilayaCode]);

  const communeLabel = (c: Commune) => (locale === 'ar' ? c.nameAr : c.nameFr);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      {state.error === 'duplicate' && <input type="hidden" name="confirmNotDuplicate" value="1" />}

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-surface p-3 text-sm font-semibold text-danger"
        >
          {te(state.error)}
        </p>
      )}

      {/* 1 — category */}
      <fieldset>
        <legend className="mb-2 text-base font-bold">{t('step1')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((c) => (
            <label
              key={c.code}
              className={`flex min-h-14 cursor-pointer items-center rounded-xl border-2 px-3 py-2 text-sm font-semibold ${
                categoryCode === c.code ? 'border-brand bg-brand text-brand-contrast' : 'border-border'
              }`}
            >
              <input
                type="radio"
                name="categoryCode"
                value={c.code}
                checked={categoryCode === c.code}
                onChange={() => setCategoryCode(c.code)}
                className="sr-only"
                required
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* 2 — location */}
      <fieldset>
        <legend className="mb-2 text-base font-bold">{t('step2')}</legend>
        <label className="block text-sm font-semibold" htmlFor="wilaya">
          {t('wilaya')}
        </label>
        <select
          id="wilaya"
          value={wilayaCode}
          onChange={(e) => {
            setWilayaCode(e.target.value);
            setCommuneId('');
          }}
          className="mt-1 min-h-12 w-full rounded-lg border border-border bg-bg px-3"
          required
        >
          <option value="">{t('chooseWilaya')}</option>
          {wilayas.map((w) => (
            <option key={w.code} value={w.code}>
              {w.label}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-sm font-semibold" htmlFor="commune">
          {t('commune')}
        </label>
        <select
          id="commune"
          name="communeId"
          value={communeId}
          onChange={(e) => setCommuneId(e.target.value)}
          className="mt-1 min-h-12 w-full rounded-lg border border-border bg-bg px-3"
          disabled={!wilayaCode}
          required
        >
          <option value="">{t('chooseCommune')}</option>
          {communes.map((c) => (
            <option key={c.id} value={c.id}>
              {communeLabel(c)}
            </option>
          ))}
        </select>
      </fieldset>

      {/* 3 — description */}
      <fieldset>
        <legend className="mb-2 text-base font-bold">{t('step3')}</legend>
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={300}
          rows={4}
          placeholder={t('bodyPlaceholder')}
          className="w-full rounded-lg border border-border bg-bg p-3"
          required
        />
        <p className="mt-1 text-sm text-muted">{t('bodyHint')}</p>
        <p className="mt-1 text-xs text-muted">
          <bdi>{body.length}</bdi> / <bdi>300</bdi>
        </p>
      </fieldset>

      {/* 4 — delivery point */}
      <fieldset>
        <legend className="mb-2 text-base font-bold">{t('step4')}</legend>
        <div className="flex flex-col gap-2">
          <label className={`rounded-xl border-2 p-3 ${deliveryPoint === 'landmark' ? 'border-brand' : 'border-border'}`}>
            <input
              type="radio"
              name="deliveryPoint"
              value="landmark"
              checked={deliveryPoint === 'landmark'}
              onChange={() => setDeliveryPoint('landmark')}
              className="me-2"
            />
            <span className="font-semibold">{t('deliveryLandmark')}</span>
            <span className="mt-1 block text-sm text-muted">{t('deliveryLandmarkHint')}</span>
          </label>

          <label className={`rounded-xl border-2 p-3 ${deliveryPoint === 'home' ? 'border-brand' : 'border-border'}`}>
            <input
              type="radio"
              name="deliveryPoint"
              value="home"
              checked={deliveryPoint === 'home'}
              onChange={() => setDeliveryPoint('home')}
              className="me-2"
            />
            <span className="font-semibold">{t('deliveryHome')}</span>
            <span className="mt-1 block text-sm text-muted">{t('deliveryHomeHint')}</span>
          </label>
        </div>

        {deliveryPoint === 'landmark' ? (
          <>
            <label className="mt-3 block text-sm font-semibold" htmlFor="landmarkHint">
              {t('landmark')}
            </label>
            <input
              id="landmarkHint"
              name="landmarkHint"
              value={landmarkHint}
              onChange={(e) => setLandmarkHint(e.target.value)}
              placeholder={t('landmarkPlaceholder')}
              className="mt-1 min-h-12 w-full rounded-lg border border-border bg-bg px-3"
              required
            />
          </>
        ) : (
          <>
            <label className="mt-3 block text-sm font-semibold" htmlFor="address">
              {t('address')}
            </label>
            <input
              id="address"
              name="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('addressPlaceholder')}
              className="mt-1 min-h-12 w-full rounded-lg border border-border bg-bg px-3"
              required
            />
          </>
        )}
      </fieldset>

      {/* Optional detail stays collapsed — one decision per screen. */}
      <div>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="min-h-12 text-sm font-semibold text-brand underline"
          aria-expanded={showMore}
        >
          {t('moreDetail')}
        </button>

        {showMore && (
          <div className="mt-3 flex flex-col gap-4">
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">{t('urgencyLabel')}</legend>
              <div className="flex gap-2">
                {(['normal', 'high', 'critical'] as const).map((u) => (
                  <label
                    key={u}
                    className={`min-h-12 flex-1 rounded-lg border-2 px-3 py-2 text-center text-sm ${
                      urgency === u ? 'border-brand font-bold' : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="urgency"
                      value={u}
                      checked={urgency === u}
                      onChange={() => setUrgency(u)}
                      className="sr-only"
                    />
                    {tu(u)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-sm font-semibold">{tb('label')}</legend>
              <div className="flex gap-2">
                {(['self', 'family', 'neighbour'] as const).map((b) => (
                  <label
                    key={b}
                    className={`min-h-12 flex-1 rounded-lg border-2 px-3 py-2 text-center text-sm ${
                      beneficiary === b ? 'border-brand font-bold' : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="beneficiary"
                      value={b}
                      checked={beneficiary === b}
                      onChange={() => setBeneficiary(b)}
                      className="sr-only"
                    />
                    {tb(b)}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </div>

      {/* 5 — phone */}
      <fieldset>
        <legend className="mb-2 text-base font-bold">{t('step5')}</legend>
        <label className="sr-only" htmlFor="phone">
          {t('phone')}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder={t('phonePlaceholder')}
          className="min-h-12 w-full rounded-lg border border-border bg-bg px-3 font-mono"
          required
        />
        <p className="mt-1 text-sm text-muted">{t('phoneHint')}</p>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="min-h-14 rounded-xl bg-brand px-5 text-lg font-bold text-brand-contrast disabled:opacity-60"
      >
        {pending ? tc('sending') : t('submit')}
      </button>
    </form>
  );
}
