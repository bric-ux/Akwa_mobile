import React, { useEffect, useRef, useCallback } from 'react';
import { InteractionManager } from 'react-native';
import { useProperties } from '../hooks/useProperties';
import { useHotels } from '../hooks/useHotels';
import { useApprovedMonthlyRentalListings } from '../hooks/useApprovedMonthlyRentalListings';
import { FEATURE_MONTHLY_RENTAL } from '../constants/features';
import { registerSearchCatalogPrefetch } from '../services/searchCatalogPrefetch';
import { preloadAmenitiesCatalog } from '../hooks/useAmenities';

const RESIDENCE_FILTERS = { rentalType: 'short_term' as const, accommodationType: 'property' as const };
const HOTEL_FILTERS = { rentalType: 'short_term' as const, accommodationType: 'hotel' as const };

/** Précharge le catalogue recherche en arrière-plan depuis l'accueil. */
const SearchCatalogWarmer: React.FC = () => {
  const warmed = useRef(false);
  const { fetchProperties } = useProperties({ source: 'search' });
  const { fetchEstablishments } = useHotels();
  const { fetchListings } = useApprovedMonthlyRentalListings();

  const prefetchResidence = useCallback(() => {
    void fetchProperties(RESIDENCE_FILTERS);
  }, [fetchProperties]);

  const prefetchHotel = useCallback(() => {
    void fetchEstablishments({});
  }, [fetchEstablishments]);

  const prefetchMonthly = useCallback(() => {
    if (FEATURE_MONTHLY_RENTAL) {
      void fetchListings({});
    }
  }, [fetchListings]);

  useEffect(() => {
    registerSearchCatalogPrefetch({ prefetchResidence, prefetchHotel, prefetchMonthly });
    return () => registerSearchCatalogPrefetch(null);
  }, [prefetchResidence, prefetchHotel, prefetchMonthly]);

  useEffect(() => {
    if (warmed.current) return;
    warmed.current = true;

    const task = InteractionManager.runAfterInteractions(() => {
      void preloadAmenitiesCatalog();
      prefetchResidence();
      prefetchHotel();
      prefetchMonthly();
    });

    return () => task.cancel();
  }, [prefetchResidence, prefetchHotel, prefetchMonthly]);

  return null;
};

export default SearchCatalogWarmer;
