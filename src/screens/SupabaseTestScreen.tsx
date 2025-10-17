import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase } from '../services/supabase';

const SupabaseTestScreen: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testBasicConnection = async () => {
    try {
      setLoading(true);
      addResult('🔍 Test de connexion de base...');
      
      const { data, error } = await supabase
        .from('properties')
        .select('count')
        .limit(1);
      
      if (error) {
        addResult(`❌ Erreur: ${error.message}`);
        return;
      }
      
      addResult('✅ Connexion de base réussie');
    } catch (error: any) {
      addResult(`❌ Erreur générale: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testGetProperties = async () => {
    try {
      setLoading(true);
      addResult('🔍 Test de récupération des propriétés...');
      
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, is_active')
        .eq('is_active', true)
        .limit(5);
      
      if (error) {
        addResult(`❌ Erreur: ${error.message}`);
        return;
      }
      
      addResult(`✅ ${data?.length || 0} propriétés récupérées`);
      
      if (data && data.length > 0) {
        data.forEach((prop, index) => {
          addResult(`  ${index + 1}. ${prop.title} (${prop.id})`);
        });
      }
    } catch (error: any) {
      addResult(`❌ Erreur générale: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testGetPropertyById = async () => {
    try {
      setLoading(true);
      addResult('🔍 Test getPropertyById...');
      
      // D'abord récupérer un ID valide
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id')
        .eq('is_active', true)
        .limit(1);
      
      if (propertiesError || !properties || properties.length === 0) {
        addResult('❌ Aucune propriété trouvée pour le test');
        return;
      }
      
      const testId = properties[0].id;
      addResult(`Test avec ID: ${testId}`);
      
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          cities:city_id (
            id,
            name,
            region
          )
        `)
        .eq('id', testId)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) {
        addResult(`❌ Erreur getPropertyById: ${error.message}`);
        addResult(`Code: ${error.code}`);
        addResult(`Details: ${error.details}`);
      } else if (!data) {
        addResult('❌ Propriété non trouvée');
      } else {
        addResult('✅ Propriété récupérée avec succès');
        addResult(`Titre: ${data.title}`);
        addResult(`Prix: ${data.price_per_night}`);
        addResult(`Ville: ${data.cities?.name || 'Non définie'}`);
      }
    } catch (error: any) {
      addResult(`❌ Erreur générale: ${error.message}`);
      addResult(`Type: ${typeof error}`);
      addResult(`Stack: ${error.stack?.substring(0, 200)}...`);
    } finally {
      setLoading(false);
    }
  };

  const runAllTests = async () => {
    clearResults();
    addResult('🚀 Démarrage des tests Supabase...');
    
    await testBasicConnection();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetProperties();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetPropertyById();
    
    addResult('🏁 Tests terminés');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test Supabase</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={runAllTests}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Lancer tous les tests</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={testBasicConnection}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test connexion</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={testGetProperties}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test propriétés</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={testGetPropertyById}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test getPropertyById</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.clearButton]} 
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>Effacer</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.resultsContainer}>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>
            {result}
          </Text>
        ))}
        {loading && (
          <Text style={styles.loadingText}>Chargement...</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2E7D32',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
  clearButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  loadingText: {
    fontSize: 16,
    color: '#2E7D32',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SupabaseTestScreen;


