# Emails manquants dans l'application mobile

## 🔴 CRITIQUE - Emails non envoyés

### 1. Annulation de réservation véhicule (Mobile)
**Fichier**: `src/components/VehicleCancellationModal.tsx`
**Problème**: Aucun email n'est envoyé lors de l'annulation
**Comparaison Web**: `cote-d-ivoire-stays/src/components/VehicleCancellationDialog.tsx` envoie des emails

**Emails à ajouter**:
- ✅ Email au locataire si le propriétaire annule (`vehicle_booking_cancelled_by_owner`)
- ✅ Email au propriétaire si le locataire annule (`vehicle_booking_cancelled_by_renter`)
- ❌ Email à l'admin (`vehicle_booking_cancelled_admin` - à créer)

**Code actuel** (ligne 108-150):
```typescript
const handleCancel = async () => {
  // ... validation ...
  const { error: updateError } = await supabase
    .from('vehicle_bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      cancellation_reason: `[Annulé par ${isOwner ? 'le propriétaire' : 'le locataire'}] ${fullReason}`,
      cancellation_penalty: penalty,
    })
    .eq('id', booking.id);
  // ❌ PAS D'EMAIL ICI
}
```

---

### 2. Modification de réservation véhicule (Mobile)
**Fichier**: `src/hooks/useVehicleBookingModifications.ts`
**Problème**: 
- Utilise le mauvais type d'email (`vehicle_booking_request` au lieu de `vehicle_modification_requested`)
- Pas d'email au locataire si le propriétaire modifie
- Pas d'email d'approbation/rejet (car modification directe, pas de système de demandes)

**Code actuel** (ligne 108-124):
```typescript
await supabase.functions.invoke('send-email', {
  body: {
    type: 'vehicle_booking_request', // ❌ MAUVAIS TYPE
    to: ownerProfile.data.email,
    // ...
  },
});
```

**À corriger**:
- Utiliser `vehicle_modification_requested` pour les modifications de réservations confirmées
- Utiliser `pending_vehicle_booking_modified_owner` pour les modifications de demandes en attente
- Envoyer aussi un email au locataire lors de la modification

---

## 🟡 AMÉLIORATIONS SUGGÉRÉES

### 3. Email à l'admin lors des annulations
**Actuellement**: Aucun email à l'admin lors des annulations de réservations véhicules
**Suggestion**: Créer `vehicle_booking_cancelled_admin` et l'envoyer systématiquement

### 4. Emails de modification pour les réservations confirmées
**Problème**: Le mobile modifie directement les réservations confirmées sans créer de demande
**Suggestion**: 
- Soit utiliser le système de demandes de modification (comme le web)
- Soit envoyer un email informatif au propriétaire ET au locataire lors de la modification directe

---

## 📊 Comparaison Web vs Mobile

| Action | Web | Mobile | Status |
|--------|-----|--------|--------|
| Annulation véhicule (propriétaire) | ✅ Email locataire | ❌ Pas d'email | 🔴 |
| Annulation véhicule (locataire) | ✅ Email propriétaire | ❌ Pas d'email | 🔴 |
| Modification demande pending | ✅ Email propriétaire | ⚠️ Email avec mauvais type | 🟡 |
| Modification réservation confirmée | ✅ Système de demandes | ⚠️ Modification directe | 🟡 |
| Approbation modification | ✅ Email locataire | ❌ N/A (pas de système) | 🟡 |
| Rejet modification | ✅ Email locataire | ❌ N/A (pas de système) | 🟡 |

---

## ✅ Emails déjà implémentés

- ✅ Création réservation véhicule (automatique/sur demande)
- ✅ Confirmation réservation véhicule (renter, owner, admin)
- ✅ Modification demande pending (partiellement - mauvais type)

---

## 🎯 Actions à prendre

1. **URGENT**: Ajouter les emails d'annulation dans `VehicleCancellationModal.tsx`
2. **URGENT**: Corriger le type d'email dans `useVehicleBookingModifications.ts`
3. **IMPORTANT**: Ajouter email à l'admin pour les annulations
4. **AMÉLIORATION**: Envisager d'utiliser le système de demandes de modification pour les réservations confirmées






















