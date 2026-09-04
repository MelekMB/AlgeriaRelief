/**
 * Dialling codes offered in the phone field.
 *
 * Algeria is first and is the default: it is the overwhelming majority case,
 * and nobody in a wildfire should be hunting through a list of 200 countries.
 * The rest are ordered by how likely they are here - the Maghreb and the
 * countries with the largest Algerian communities, then the Gulf, then the
 * remainder.
 */
export type CountryCode = {
  /** Dialling code without the plus. */
  dial: string;
  nameAr: string;
  nameFr: string;
};

export const DEFAULT_DIAL = '213';

export const COUNTRY_CODES: CountryCode[] = [
  { dial: '213', nameAr: 'الجزائر', nameFr: 'Algérie' },

  // Largest Algerian communities abroad.
  { dial: '33', nameAr: 'فرنسا', nameFr: 'France' },
  { dial: '34', nameAr: 'إسبانيا', nameFr: 'Espagne' },
  { dial: '39', nameAr: 'إيطاليا', nameFr: 'Italie' },
  { dial: '32', nameAr: 'بلجيكا', nameFr: 'Belgique' },
  { dial: '44', nameAr: 'المملكة المتحدة', nameFr: 'Royaume-Uni' },
  { dial: '49', nameAr: 'ألمانيا', nameFr: 'Allemagne' },
  { dial: '41', nameAr: 'سويسرا', nameFr: 'Suisse' },
  { dial: '31', nameAr: 'هولندا', nameFr: 'Pays-Bas' },
  { dial: '1', nameAr: 'كندا / الولايات المتحدة', nameFr: 'Canada / États-Unis' },

  // Neighbours.
  { dial: '216', nameAr: 'تونس', nameFr: 'Tunisie' },
  { dial: '212', nameAr: 'المغرب', nameFr: 'Maroc' },
  { dial: '218', nameAr: 'ليبيا', nameFr: 'Libye' },
  { dial: '222', nameAr: 'موريتانيا', nameFr: 'Mauritanie' },
  { dial: '223', nameAr: 'مالي', nameFr: 'Mali' },
  { dial: '227', nameAr: 'النيجر', nameFr: 'Niger' },

  // Gulf and wider Arab world.
  { dial: '971', nameAr: 'الإمارات', nameFr: 'Émirats arabes unis' },
  { dial: '966', nameAr: 'السعودية', nameFr: 'Arabie saoudite' },
  { dial: '974', nameAr: 'قطر', nameFr: 'Qatar' },
  { dial: '965', nameAr: 'الكويت', nameFr: 'Koweït' },
  { dial: '973', nameAr: 'البحرين', nameFr: 'Bahreïn' },
  { dial: '968', nameAr: 'عُمان', nameFr: 'Oman' },
  { dial: '20', nameAr: 'مصر', nameFr: 'Égypte' },
  { dial: '962', nameAr: 'الأردن', nameFr: 'Jordanie' },
  { dial: '961', nameAr: 'لبنان', nameFr: 'Liban' },
  { dial: '90', nameAr: 'تركيا', nameFr: 'Turquie' },

  // Rest of Europe.
  { dial: '351', nameAr: 'البرتغال', nameFr: 'Portugal' },
  { dial: '43', nameAr: 'النمسا', nameFr: 'Autriche' },
  { dial: '46', nameAr: 'السويد', nameFr: 'Suède' },
  { dial: '47', nameAr: 'النرويج', nameFr: 'Norvège' },
  { dial: '45', nameAr: 'الدنمارك', nameFr: 'Danemark' },
  { dial: '353', nameAr: 'أيرلندا', nameFr: 'Irlande' },
];

/** Formats one option label for a given locale. */
export function countryLabel(country: CountryCode, locale: string): string {
  const name = locale === 'ar' ? country.nameAr : country.nameFr;
  return `${name} +${country.dial}`;
}
