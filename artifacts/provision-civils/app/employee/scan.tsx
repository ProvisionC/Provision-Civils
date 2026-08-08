import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import * as Location from 'expo-location';

export default function AttendanceScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const colors = useColors();
  const { token } = useAuth();

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

  const handleAttendance = async (clockNumber: string, type: 'IN' | 'OUT') => {
    try {
        let gps = undefined;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({});
            gps = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        }

        const response = await fetch(`https://provision-api-ckpk.onrender.com/attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ clockNumber, type, gps })
        });
        
        if (!response.ok) throw new Error(await response.text());
        Alert.alert('Success', `Employee clocked ${type} successfully`);
    } catch (e: any) {
        Alert.alert('Error', e.message || 'Attendance failed');
    } finally {
        setScanned(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Alert.alert('Scanned', `Employee: ${data}`, [
        { text: 'Clock IN', onPress: () => handleAttendance(data, 'IN') },
        { text: 'Clock OUT', onPress: () => handleAttendance(data, 'OUT') },
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
