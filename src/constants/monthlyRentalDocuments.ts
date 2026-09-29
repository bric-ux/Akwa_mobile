/** Documents que le propriétaire peut exiger pour une candidature bail longue durée. */
export const MONTHLY_RENTAL_DOCUMENT_OPTIONS = [
  { id: 'cni', label: 'Pièce d’identité (CNI / passeport)' },
  { id: 'fiche_paie', label: '3 dernières fiches de paie' },
  { id: 'attestation_travail', label: 'Attestation de travail / contrat' },
  { id: 'releve_bancaire', label: 'Relevé bancaire' },
  { id: 'caution_garant', label: 'Acte de caution / garant' },
  { id: 'justificatif_domicile', label: 'Justificatif de domicile' },
  { id: 'avis_imposition', label: 'Avis d’imposition' },
] as const;

export type MonthlyRentalDocumentId =
  (typeof MONTHLY_RENTAL_DOCUMENT_OPTIONS)[number]['id'];

export type MonthlyRentalApplicationDocument = {
  type: string;
  url: string;
  name: string;
};

export function monthlyRentalDocumentLabel(id: string): string {
  const found = MONTHLY_RENTAL_DOCUMENT_OPTIONS.find((d) => d.id === id);
  return found?.label ?? id;
}
