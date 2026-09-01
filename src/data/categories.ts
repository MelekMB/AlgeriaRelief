/**
 * Fixed category list. Deliberately short — a stressed user scanning on a
 * phone cannot triage twenty options. Icon + text always; never icon alone
 * (ambiguous across cultures) and never text alone (slow to scan).
 */
export const CATEGORIES = [
  { code: 'water_food', nameAr: 'ماء وطعام', nameFr: 'Eau et nourriture', icon: 'water', sortOrder: 1 },
  { code: 'shelter', nameAr: 'مأوى', nameFr: 'Hébergement', icon: 'home', sortOrder: 2 },
  { code: 'clothing', nameAr: 'ملابس وأغطية', nameFr: 'Vêtements et couvertures', icon: 'shirt', sortOrder: 3 },
  { code: 'medicine', nameAr: 'أدوية ومستلزمات طبية', nameFr: 'Médicaments et soins', icon: 'medkit', sortOrder: 4 },
  { code: 'transport', nameAr: 'نقل', nameFr: 'Transport', icon: 'car', sortOrder: 5 },
  { code: 'livestock_feed', nameAr: 'علف الماشية', nameFr: 'Aliment pour bétail', icon: 'livestock', sortOrder: 6 },
  { code: 'labour', nameAr: 'أيادٍ للمساعدة', nameFr: 'Bras pour aider', icon: 'hands', sortOrder: 7 },
  { code: 'other', nameAr: 'أخرى', nameFr: 'Autre', icon: 'dots', sortOrder: 8 },
] as const;

export type CategoryCode = (typeof CATEGORIES)[number]['code'];
