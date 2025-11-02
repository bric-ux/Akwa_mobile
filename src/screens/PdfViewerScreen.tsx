import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Text } from 'react-native';

type RouteParams = { url: string; title?: string };

const PdfViewerScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { url, title } = (route.params || {}) as RouteParams;

  // Sur Android, utiliser un viewer embarqué pour fiabilité
  const viewerUrl = Platform.select({
    ios: url,
    android: `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`,
    default: url,
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Document PDF'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <WebView
        source={{ uri: viewerUrl as string }}
        style={styles.webview}
        startInLoadingState
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        setSupportMultipleWindows={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  webview: {
    flex: 1,
  },
});

export default PdfViewerScreen;



