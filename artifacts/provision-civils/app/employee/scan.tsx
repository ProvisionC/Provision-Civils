import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function AttendanceScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const colors = useColors();

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', color: colors.foreground, marginBottom: 10 }}>We need your permission to show the camera</Text>
        <TouchableOpacity onPress={requestPermission} style={[styles.button, {backgroundColor: colors.primary}]}>
          <Text style={{color: '#FFF'}}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Alert.alert('Scanned', `Clocking for: ${data}`, [
        { text: 'Clock IN', onPress: () => { Alert.alert('Success', 'Clocked IN'); setScanned(false); } },
        { text: 'Clock OUT', onPress: () => { Alert.alert('Success', 'Clocked OUT'); setScanned(false); } },
        { text: 'Cancel', onPress: () => setScanned(false) }
    ]);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      <View style={styles.overlay}>
        <Text style={styles.text}>Scan employee QR code</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  overlay: { position: 'absolute', top: 50, left: 0, right: 0, alignItems: 'center' },
  text: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  button: { padding: 15, borderRadius: 10, alignItems: 'center' }
});
