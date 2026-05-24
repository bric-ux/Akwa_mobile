#!/usr/bin/env bash
# Affiche les empreintes SHA-256 Android pour assetlinks.json (Google Play App Links).
# Usage (depuis AkwaHomeMobile/) :
#   eas credentials -p android
#   ./scripts/print-android-app-link-fingerprint.sh
#
# Ou récupérer dans Google Play Console → Intégrité de l'appli → Certificat de signature de l'appli.

set -euo pipefail

echo "=== Android App Links — empreinte SHA-256 ==="
echo ""
echo "1. Production EAS : eas credentials -p android → Keystore → SHA256 Fingerprint"
echo "2. Play Console : Setup → App integrity → App signing key certificate"
echo ""
echo "Coller la valeur (avec deux-points) dans :"
echo "  cote-d-ivoire-stays/public/.well-known/assetlinks.json"
echo ""
echo "Exemple : AB:CD:EF:...:12"
echo ""
echo "=== iOS Universal Links — Team ID ==="
echo ""
echo "Remplacer REPLACE_WITH_APPLE_TEAM_ID dans :"
echo "  cote-d-ivoire-stays/public/.well-known/apple-app-site-association"
echo ""
echo "Format appID : {TEAM_ID}.com.jeanbrice270.akwahomemobile"
echo "Team ID : Apple Developer → Membership → Team ID"
echo ""
echo "Puis redéployer le site (Cloudflare Pages) et publier une nouvelle build mobile (eas build)."
