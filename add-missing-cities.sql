-- Script pour ajouter les villes manquantes à la table cities
-- Exécuter ce script dans votre dashboard Supabase

INSERT INTO cities (id, name, region, country) VALUES 
  (gen_random_uuid(), 'Yamoussoukro', 'Yamoussoukro', 'Côte d''Ivoire'),
  (gen_random_uuid(), 'Bouaké', 'Vallée du Bandama', 'Côte d''Ivoire'),
  (gen_random_uuid(), 'San-Pédro', 'Bas-Sassandra', 'Côte d''Ivoire'),
  (gen_random_uuid(), 'Korhogo', 'Savanes', 'Côte d''Ivoire'),
  (gen_random_uuid(), 'Man', 'Tonkpi', 'Côte d''Ivoire'),
  (gen_random_uuid(), 'Gagnoa', 'Gôh', 'Côte d''Ivoire'),
  (gen_random_uuid(), 'Daloa', 'Haut-Sassandra', 'Côte d''Ivoire'),
  (gen_random_uuid(), 'Divo', 'Lôh-Djiboua', 'Côte d''Ivoire'),
  (gen_random_uuid(), 'Anyama', 'Lagunes', 'Côte d''Ivoire'),
  (gen_random_uuid(), 'Bingerville', 'Lagunes', 'Côte d''Ivoire')
ON CONFLICT (name) DO NOTHING;

-- Vérifier les villes ajoutées
SELECT name, region FROM cities ORDER BY name;
