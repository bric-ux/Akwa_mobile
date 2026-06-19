import React, { useEffect, useRef } from 'react';
import { useProperties } from '../hooks/useProperties';
import { useHotels } from '../hooks/useHotels';
import { useApprovedMonthlyRentalListings } from '../hooks/useApprovedMonthlyRentalListings';
import { FEATURE_MONTHLY_RENTAL } from '../constants/features';

/** Précharge le catalogue recherche en arrière-plan depuis l'accueil. */
const SearchCatalogWarmer: React.FC = () => {
  const warmed = useRef(false);
  const { fetchProperties } = useProperties({ source: 'search' });
  const { fetchEstablishments } = useHotels();
  const { fetchListings } = useApprovedMonthlyRentalListings();

  useEffect(() => {
    if (warmed.current) return;
    warmed.current = true;

    const run = () => {
      void fetchProperties({ rentalType: 'short_term', accommodationType: 'property' });
      void fetchEstablishments({});
      if (FEATURE_MONTHLY_RENTAL) {
        void fetchListings({});
      }
    };

    const timer = setTimeout(run, 400);
    return () => clearTimeout(timer);
  }, [fetchProperties, fetchEstablishments, fetchListings]);

  return null;
};

export default SearchCatalogWarmer;
