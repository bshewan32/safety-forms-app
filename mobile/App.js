import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';

const App = () => {
  const handleCameraPress = () => {
    Alert.alert('Camera', 'Camera functionality will be implemented here');
  };

  const handleGalleryPress = () => {
    Alert.alert('Gallery', 'Gallery functionality will be implemented here');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text style={styles.title}>Safety Forms</Text>
          <Text style={styles.subtitle}>Photo Capture & Processing</Text>
        </View>
        
        <View style={styles.content}>
          <TouchableOpacity style={styles.button} onPress={handleCameraPress}>
            <Text style={styles.buttonText}>📸 Take Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={handleGalleryPress}>
            <Text style={styles.buttonText}>🖼️ Select from Gallery</Text>
          </TouchableOpacity>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>How it works:</Text>
            <Text style={styles.infoText}>
              1. Take a photo of your safety form{'\n'}
              2. AI extracts and analyzes the content{'\n'}
              3. Supervisor reviews flagged issues{'\n'}
              4. Form is digitally archived
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#2563eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#e2e8f0',
  },
  content: {
    padding: 20,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1f2937',
  },
  infoText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4b5563',
  },
});

export default App;
