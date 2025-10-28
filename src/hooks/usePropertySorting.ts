import { useMemo } from 'react';
import { Property } from '../types';

export type SortOption = 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'newest';

export const usePropertySorting = (properties: Property[], sortBy: SortOption) => {
  const sortedProperties = useMemo(() => {
    if (!properties || properties.length === 0) return [];

    const sorted = [...properties];
    
    // Debug: afficher les données de tri
    console.log('🔍 Tri des propriétés:', {
      sortBy,
      count: sorted.length,
      sample: sorted.slice(0, 2).map(p => ({
        title: p.title,
        price: p.price_per_night,
        rating: p.rating,
        review_count: p.review_count,
        created_at: p.created_at
      }))
    });

    switch (sortBy) {
      case 'price_asc':
        console.log('📊 Tri prix croissant avant:', sorted.map(p => ({ title: p.title, price: p.price_per_night })));
        const sortedAsc = sorted.sort((a, b) => (a.price_per_night || 0) - (b.price_per_night || 0));
        console.log('📊 Tri prix croissant après:', sortedAsc.map(p => ({ title: p.title, price: p.price_per_night })));
        return sortedAsc;
      
      case 'price_desc':
        console.log('📊 Tri prix décroissant avant:', sorted.map(p => ({ title: p.title, price: p.price_per_night })));
        const sortedDesc = sorted.sort((a, b) => (b.price_per_night || 0) - (a.price_per_night || 0));
        console.log('📊 Tri prix décroissant après:', sortedDesc.map(p => ({ title: p.title, price: p.price_per_night })));
        return sortedDesc;
      
      case 'rating':
        return sorted.sort((a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          if (ratingA === ratingB) {
            // En cas d'égalité, trier par nombre d'avis
            return (b.review_count || 0) - (a.review_count || 0);
          }
          return ratingB - ratingA;
        });
      
      case 'newest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });
      
      case 'popular':
      default:
        // Tri par popularité : combinaison de rating et nombre d'avis
        return sorted.sort((a, b) => {
          const scoreA = (a.rating || 0) * Math.log((a.review_count || 0) + 1);
          const scoreB = (b.rating || 0) * Math.log((b.review_count || 0) + 1);
          return scoreB - scoreA;
        });
    }
  }, [properties, sortBy]);

  return sortedProperties;
};
