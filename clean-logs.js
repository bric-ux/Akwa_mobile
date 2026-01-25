#!/usr/bin/env node
/**
 * Script pour nettoyer les logs console dans le projet
 * Remplace console.log/error/warn par des versions conditionnelles
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, 'src');
const isDev = '__DEV__';

// Fonction pour nettoyer un fichier
function cleanLogsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Remplacer console.log par des versions conditionnelles
  // Garder seulement les erreurs critiques
  const patterns = [
    // Supprimer les console.log de debug avec emojis
    {
      regex: /console\.log\([^)]*['"`][📧✅❌⚠️🔍📊🗺️💰📍🔄🟢🔴][^)]*\);?\s*/g,
      replacement: ''
    },
    // Remplacer console.log par version conditionnelle
    {
      regex: /console\.log\(/g,
      replacement: '__DEV__ && console.log('
    },
    // Remplacer console.warn par version conditionnelle
    {
      regex: /console\.warn\(/g,
      replacement: '__DEV__ && console.warn('
    },
    // Remplacer console.info par version conditionnelle
    {
      regex: /console\.info\(/g,
      replacement: '__DEV__ && console.info('
    },
    // Remplacer console.debug par version conditionnelle
    {
      regex: /console\.debug\(/g,
      replacement: '__DEV__ && console.debug('
    },
    // Garder console.error mais conditionnel
    {
      regex: /console\.error\(/g,
      replacement: '__DEV__ && console.error('
    }
  ];

  patterns.forEach(({ regex, replacement }) => {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

// Fonction récursive pour parcourir les fichiers
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let cleanedCount = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Ignorer node_modules et autres dossiers
      if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
        cleanedCount += processDirectory(filePath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      if (cleanLogsInFile(filePath)) {
        cleanedCount++;
        console.log(`Nettoyé: ${filePath}`);
      }
    }
  });

  return cleanedCount;
}

// Exécuter le nettoyage
console.log('🧹 Nettoyage des logs console...');
const cleaned = processDirectory(SRC_DIR);
console.log(`✅ ${cleaned} fichiers nettoyés`);





