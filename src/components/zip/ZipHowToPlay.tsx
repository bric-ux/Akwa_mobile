import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ZipGrid from './ZipGrid';
import { ZIP_DEMO_GRIDS } from '../../games/zip/zipDemoGrids';

const DEMO_CELL_SIZE = 26;

export default function ZipHowToPlay() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Comment jouer ?</Text>
      <Text style={styles.body}>
        Reliez <Text style={styles.bold}>toutes les cases</Text> sans lever le doigt. Passez par les chiffres
        dans l'ordre : <Text style={styles.bold}>1 → 2 → 3…</Text> Commencez toujours sur le{' '}
        <Text style={styles.green}>1</Text>.
      </Text>
      <View style={styles.examples}>
        {ZIP_DEMO_GRIDS.map(({ puzzle, caption }) => (
          <View key={puzzle.id} style={styles.example}>
            <View style={styles.gridClip}>
              <ZipGrid
                puzzle={puzzle}
                path={[]}
                onPathChange={() => {}}
                cellSize={DEMO_CELL_SIZE}
                disabled
                reviewPath={puzzle.solutionPath}
                reviewSilent
              />
            </View>
            <Text style={styles.caption}>{caption}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    marginTop: 8,
    paddingTop: 16,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  bold: { fontWeight: '700', color: '#334155' },
  green: { fontWeight: '800', color: '#15803d' },
  examples: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  example: {
    alignItems: 'center',
    gap: 6,
  },
  gridClip: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  caption: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
