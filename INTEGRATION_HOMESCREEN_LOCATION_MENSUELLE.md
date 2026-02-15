# 🏠 Intégration Location Mensuelle dans HomeScreen

## 📋 Vue d'Ensemble

Le `HomeScreen` affiche actuellement toutes les propriétés sans distinction. Il faut ajouter un moyen de basculer entre **location courte durée** et **location mensuelle**.

---

## 🎯 Options d'Intégration

### Option 1 : Sélecteur d'Onglets (Recommandé) ⭐

Ajouter un sélecteur d'onglets en haut, juste après le header, pour basculer entre les deux types de location.

**Avantages** :
- Interface claire et intuitive
- Facile à comprendre pour l'utilisateur
- Cohérent avec le reste de l'app

**Inconvénients** :
- Prend un peu d'espace vertical

---

### Option 2 : Section Promotionnelle

Ajouter une section promotionnelle similaire à celle des véhicules, qui redirige vers une page dédiée.

**Avantages** :
- Mise en avant de la nouvelle fonctionnalité
- Ne modifie pas l'affichage actuel
- Design cohérent avec les autres sections promo

**Inconvénients** :
- Nécessite un clic supplémentaire pour voir les biens mensuels
- Moins direct

---

### Option 3 : Filtre dans la Section Propriétés

Ajouter un filtre dans la section "Nos propriétés disponibles" pour filtrer par type.

**Avantages** :
- Minimaliste
- Ne change pas beaucoup l'interface

**Inconvénients** :
- Moins visible
- Peut être confondu avec d'autres filtres

---

### Option 4 : Combinaison (Recommandé pour MVP) ⭐⭐

Combiner Option 1 + Option 2 : Section promotionnelle + Onglets pour basculer.

**Avantages** :
- Mise en avant de la fonctionnalité
- Accès direct via onglets
- Meilleure UX

---

## 💻 Implémentation - Option 1 : Sélecteur d'Onglets

### Étape 1 : Ajouter l'état pour le type de location

```typescript
// Dans HomeScreen.tsx, ajouter après les autres useState
const [rentalType, setRentalType] = useState<'short_term' | 'monthly'>('short_term');
```

### Étape 2 : Filtrer les propriétés selon le type

```typescript
// Filtrer les propriétés selon le type sélectionné
const filteredProperties = React.useMemo(() => {
  if (rentalType === 'monthly') {
    // Filtrer les propriétés avec is_monthly_rental = true
    return properties.filter(p => p.is_monthly_rental === true);
  } else {
    // Filtrer les propriétés avec is_monthly_rental = false ou null
    return properties.filter(p => !p.is_monthly_rental);
  }
}, [properties, rentalType]);
```

### Étape 3 : Ajouter le sélecteur d'onglets dans renderListHeader

```typescript
const renderListHeader = () => (
  <>
    <HeroSection onSearchPress={handleSearchPress} />
    <WeatherDateTimeWidget />

    {/* Sélecteur Type de Location */}
    <View style={styles.rentalTypeSelector}>
      <TouchableOpacity
        style={[
          styles.rentalTypeTab,
          rentalType === 'short_term' && styles.rentalTypeTabActive
        ]}
        onPress={() => setRentalType('short_term')}
      >
        <Ionicons 
          name="calendar-outline" 
          size={20} 
          color={rentalType === 'short_term' ? '#fff' : '#666'} 
        />
        <Text style={[
          styles.rentalTypeTabText,
          rentalType === 'short_term' && styles.rentalTypeTabTextActive
        ]}>
          Location courte durée
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.rentalTypeTab,
          rentalType === 'monthly' && styles.rentalTypeTabActive
        ]}
        onPress={() => setRentalType('monthly')}
      >
        <Ionicons 
          name="home-outline" 
          size={20} 
          color={rentalType === 'monthly' ? '#fff' : '#666'} 
        />
        <Text style={[
          styles.rentalTypeTabText,
          rentalType === 'monthly' && styles.rentalTypeTabTextActive
        ]}>
          Location mensuelle
        </Text>
      </TouchableOpacity>
    </View>

    {/* Sections promotionnelles (uniquement pour location courte durée) */}
    {rentalType === 'short_term' && (
      <>
        {/* Section Promotionnelle Location de véhicules */}
        <View style={styles.vehiclesPromoSection}>
          {/* ... code existant ... */}
        </View>

        {/* Section Promotionnelle Conciergerie */}
        <View style={styles.conciergeriePromoSection}>
          {/* ... code existant ... */}
        </View>
      </>
    )}

    {/* Section Promotionnelle Location Mensuelle (uniquement pour location mensuelle) */}
    {rentalType === 'monthly' && (
      <View style={styles.monthlyRentalPromoSection}>
        <ImageBackground
          source={require('../../assets/images/monthly-rental-bg.jpg')} // À créer
          style={styles.monthlyRentalPromoBackground}
          imageStyle={styles.monthlyRentalPromoImageStyle}
          resizeMode="cover"
        >
          <View style={styles.monthlyRentalPromoOverlay}>
            <View style={styles.monthlyRentalPromoContent}>
              <View style={styles.monthlyRentalPromoLeft}>
                <View style={styles.monthlyRentalPromoBadge}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.monthlyRentalPromoBadgeText}>NOUVEAU</Text>
                </View>
                <Text style={styles.monthlyRentalPromoTitle}>
                  Location Mensuelle
                </Text>
                <Text style={styles.monthlyRentalPromoSubtitle}>
                  Trouvez votre logement idéal
                </Text>
                <Text style={styles.monthlyRentalPromoDescription}>
                  Des appartements et maisons disponibles en location longue durée. Visites gratuites, processus simplifié.
                </Text>
                <View style={styles.monthlyRentalPromoFeatures}>
                  <View style={styles.monthlyRentalPromoFeature}>
                    <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                    <Text style={styles.monthlyRentalPromoFeatureText}>Visites gratuites</Text>
                  </View>
                  <View style={styles.monthlyRentalPromoFeature}>
                    <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                    <Text style={styles.monthlyRentalPromoFeatureText}>Processus simplifié</Text>
                  </View>
                  <View style={styles.monthlyRentalPromoFeature}>
                    <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                    <Text style={styles.monthlyRentalPromoFeatureText}>Large choix</Text>
                  </View>
                </View>
              </View>
              <View style={styles.monthlyRentalPromoRight}>
                <View style={styles.monthlyRentalPromoIconContainer}>
                  <Ionicons name="home" size={64} color="#2E7D32" />
                </View>
              </View>
            </View>
          </View>
        </ImageBackground>
      </View>
    )}

    <PopularDestinations
      destinations={popularDestinations}
      onDestinationPress={handleDestinationPress}
      loading={destinationsLoading}
    />

    {rentalType === 'short_term' && (
      <ImageCarousel
        images={carouselImages}
        onImagePress={(image) => {}}
      />
    )}

    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {rentalType === 'monthly' 
            ? 'Biens en location mensuelle' 
            : 'Nos propriétés disponibles'}
        </Text>
        <Text style={styles.propertyCount}>
          {filteredProperties.length} {rentalType === 'monthly' ? 'bien' : 'propriété'}
          {filteredProperties.length > 1 ? 's' : ''} trouvé{filteredProperties.length > 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  </>
);
```

### Étape 4 : Utiliser filteredProperties dans FlatList

```typescript
<FlatList
  style={styles.content}
  data={filteredProperties}  // Utiliser filteredProperties au lieu de properties
  renderItem={renderPropertyCard}
  keyExtractor={(item) => item.id}
  showsVerticalScrollIndicator={false}
  contentContainerStyle={styles.scrollContent}
  ListHeaderComponent={renderListHeader}
  ListEmptyComponent={() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>
        {rentalType === 'monthly' 
          ? 'Aucun bien en location mensuelle' 
          : t('property.noProperties')}
      </Text>
      <Text style={styles.emptySubtitle}>
        {rentalType === 'monthly'
          ? 'Aucun bien disponible pour le moment. Revenez plus tard !'
          : t('property.noPropertiesDesc')}
      </Text>
    </View>
  )}
/>
```

### Étape 5 : Ajouter les styles

```typescript
const styles = StyleSheet.create({
  // ... styles existants ...

  // Sélecteur Type de Location
  rentalTypeSelector: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rentalTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  rentalTypeTabActive: {
    backgroundColor: '#e67e22',
  },
  rentalTypeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  rentalTypeTabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },

  // Section Promotionnelle Location Mensuelle
  monthlyRentalPromoSection: {
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  monthlyRentalPromoBackground: {
    width: '100%',
    minHeight: 200,
    borderRadius: 16,
  },
  monthlyRentalPromoImageStyle: {
    borderRadius: 16,
  },
  monthlyRentalPromoOverlay: {
    backgroundColor: 'rgba(46, 125, 50, 0.85)', // Vert avec overlay
    padding: 20,
    borderRadius: 16,
    minHeight: 200,
  },
  monthlyRentalPromoContent: {
    flexDirection: 'row',
  },
  monthlyRentalPromoLeft: {
    flex: 1,
    paddingRight: 12,
  },
  monthlyRentalPromoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    gap: 4,
  },
  monthlyRentalPromoBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FF8C00',
    letterSpacing: 0.5,
  },
  monthlyRentalPromoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  monthlyRentalPromoSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  monthlyRentalPromoDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  monthlyRentalPromoFeatures: {
    gap: 8,
  },
  monthlyRentalPromoFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthlyRentalPromoFeatureText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  monthlyRentalPromoRight: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  monthlyRentalPromoIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

---

## 🔄 Modification de handlePropertyPress

Il faut rediriger vers le bon écran selon le type de location :

```typescript
const handlePropertyPress = (property: Property) => {
  if (property.is_monthly_rental) {
    // Rediriger vers l'écran de détails location mensuelle
    navigation.navigate('MonthlyRentalDetails', { propertyId: property.id });
  } else {
    // Rediriger vers l'écran de détails location courte durée (existant)
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  }
};
```

---

## 📱 Option 2 : Section Promotionnelle Seulement

Si vous préférez juste une section promotionnelle sans onglets :

### Ajouter dans renderListHeader (après la section véhicules)

```typescript
{/* Section Promotionnelle Location Mensuelle */}
<View style={styles.monthlyRentalPromoSection}>
  <TouchableOpacity
    style={styles.monthlyRentalPromoCard}
    onPress={() => {
      // Naviguer vers la page dédiée location mensuelle
      (navigation as any).navigate('MonthlyRentalList');
    }}
    activeOpacity={0.9}
  >
    {/* Même design que la section véhicules */}
    {/* ... code de la section promo ... */}
  </TouchableOpacity>
</View>
```

---

## 🎨 Design Recommandé

### Sélecteur d'Onglets
- Style : Pills/Tabs avec fond blanc et ombre légère
- Couleur active : Orange AkwaHome (#e67e22)
- Icônes : Calendar pour courte durée, Home pour mensuelle
- Position : Juste après le HeroSection

### Section Promotionnelle
- Style : Similaire à la section véhicules
- Couleur : Vert (#2E7D32) pour différencier
- Contenu : Titre, description, 3 avantages, badge "NOUVEAU"
- Image de fond : Photo d'appartement/maison (à créer)

---

## ✅ Checklist d'Intégration

- [ ] Ajouter l'état `rentalType`
- [ ] Créer la fonction de filtrage `filteredProperties`
- [ ] Ajouter le sélecteur d'onglets dans `renderListHeader`
- [ ] Ajouter la section promotionnelle location mensuelle
- [ ] Modifier `handlePropertyPress` pour rediriger vers le bon écran
- [ ] Utiliser `filteredProperties` dans `FlatList`
- [ ] Ajouter les styles
- [ ] Tester le basculement entre les deux types
- [ ] Vérifier que les propriétés sont bien filtrées
- [ ] Tester sur différents appareils

---

## 🔍 Points d'Attention

### 1. Type de Propriété dans la Base de Données

Assurez-vous que la colonne `is_monthly_rental` existe dans la table `properties` :
```sql
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS is_monthly_rental BOOLEAN DEFAULT false;
```

### 2. Hook useProperties

Vérifiez que `useProperties` charge bien toutes les propriétés (courte durée + mensuelle). Si besoin, créer un hook séparé `useMonthlyRentalProperties`.

### 3. Navigation

Ajouter la route `MonthlyRentalDetails` dans `AppNavigator.tsx` :
```typescript
<Stack.Screen
  name="MonthlyRentalDetails"
  component={MonthlyRentalDetailsScreen}
  options={{ title: 'Détails du bien' }}
/>
```

### 4. Performance

Le filtrage avec `useMemo` évite de recalculer à chaque render. C'est important pour les performances.

---

## 📝 Résumé

**Option recommandée** : Option 1 (Sélecteur d'onglets) + Section promotionnelle conditionnelle

**Avantages** :
- Interface claire
- Accès direct aux deux types de location
- Mise en avant de la nouvelle fonctionnalité
- Cohérent avec le reste de l'app

**Modifications minimales** :
- Ajout d'un état
- Ajout d'un sélecteur d'onglets
- Filtrage des propriétés
- Section promo conditionnelle

---

**Document créé le** : 2025-02-08  
**Version** : 1.0

