export const MONTHLY_FURNISHED_OPTIONS = [
  {
    value: false,
    label: 'Logement non meublé',
    shortLabel: 'Non meublé',
    description:
      'Le locataire aménage le logement lui-même. Pas de mobilier ni d’électroménager fournis.',
    hint: 'Vous indiquerez uniquement les équipements du logement (eau, électricité, etc.).',
  },
  {
    value: true,
    label: 'Logement meublé',
    shortLabel: 'Meublé',
    description:
      'Le logement est prêt à habiter : mobilier, literie et équipements de base inclus.',
    hint: 'Vous pourrez préciser le mobilier et les équipements fournis.',
  },
] as const;
