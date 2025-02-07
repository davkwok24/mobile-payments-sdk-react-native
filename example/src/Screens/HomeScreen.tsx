import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import HeaderButton from '../components/HeaderButton';
import LoadingButton from '../components/LoadingButton';
import uuid from 'react-native-uuid';
import {
  AdditionalPaymentMethodType,
  CurrencyCode,
  startPayment,
  PromptMode,
  mapUserInfoToFailure,
} from 'mobile-payments-sdk-react-native';
import { BleManager } from 'react-native-ble-plx';
import base64 from 'react-native-base64';

// HM10 default UUIDs (commonly used by HM-10 modules)
const HM10_SERVICE_UUID = '0000FFE0-0000-1000-8000-00805F9B34FB';
const HM10_CHARACTERISTIC_UUID = '0000FFE1-0000-1000-8000-00805F9B34FB';

const HomeView = () => {
  const navigation = useNavigation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [waterQuantity, setWaterQuantity] = useState(0);
  const [primeQuantity, setPrimeQuantity] = useState(0);
  const totalAmount = (waterQuantity * 1.99 + primeQuantity * 2.99).toFixed(2);

  // BLE state variables
  const [bleManager] = useState(new BleManager());
  const [device, setDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Prompt for admin password on long press of "Menu"
  const handleLongPress = () => {
    if (!isAdmin) {
      Alert.prompt(
        "Admin Login",
        "Enter password",
        (password) => {
          if (password === "8888") {
            setIsAdmin(true);
          } else {
            Alert.alert("Incorrect Password");
          }
        }
      );
    }
  };

  // When admin mode is enabled, try connecting to DSD TECH if not connected yet.
  useEffect(() => {
    if (isAdmin && !device && !isConnecting) {
      connectToDSDTECH();
    }
  }, [isAdmin]);

  // Connect to DSD TECH by scanning for devices without a service filter.
  const connectToDSDTECH = () => {
    setIsConnecting(true);
    // Scan for all devices (no service filter)
    bleManager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        Alert.alert("Bluetooth Error", error.message);
        setIsConnecting(false);
        return;
      }
      // Look for a device whose name includes "DSD TECH"
      if (scannedDevice && scannedDevice.name && scannedDevice.name.includes("DSD TECH")) {
        bleManager.stopDeviceScan();
        scannedDevice.connect()
          .then((device) => device.discoverAllServicesAndCharacteristics())
          .then((device) => {
            setDevice(device);
            setIsConnecting(false);
            Alert.alert("Connected", "Connected to DSD TECH device");
          })
          .catch((error) => {
            Alert.alert("Connection Error", error.message);
            setIsConnecting(false);
          });
      }
    });
    // Stop scanning after 10 seconds if no device is found.
    setTimeout(() => {
      bleManager.stopDeviceScan();
      if (!device) {
        Alert.alert("Connection Timeout", "Could not find DSD TECH device");
        setIsConnecting(false);
      }
    }, 10000);
  };

  // Function to send a command (e.g., "A" or "B") via BLE.
  const sendBluetoothCommand = async (command) => {
    if (!device) {
      Alert.alert("Error", "Not connected to DSD TECH device");
      return;
    }
    try {
      // Convert command to base64 as required by BLE write.
      const commandBase64 = base64.encode(command);
      // Use writeCharacteristicWithoutResponseForDevice because HM-10 modules typically support this write type
      await bleManager.writeCharacteristicWithoutResponseForDevice(
        device.id,
        HM10_SERVICE_UUID,
        HM10_CHARACTERISTIC_UUID,
        commandBase64
      );
      Alert.alert("Success", `Command ${command} sent successfully`);
    } catch (error) {
      Alert.alert("Send Error", error.message);
    }
  };

  const sendCommandA = () => sendBluetoothCommand("A");
  const sendCommandB = () => sendBluetoothCommand("B");

  // Payment function remains unchanged.
  const handleStartPayment = async () => {
    const amount = Math.round(parseFloat(totalAmount) * 100);
    const paymentParameters = {
      amountMoney: { amount: amount, currencyCode: CurrencyCode.USD },
      appFeeMoney: { amount: 0, currencyCode: CurrencyCode.USD },
      idempotencyKey: uuid.v4(),
      note: 'Payment for services',
    };

    const promptParameters = {
      additionalMethods: [AdditionalPaymentMethodType.ALL],
      mode: PromptMode.DEFAULT,
    };

    try {
      const payment = await startPayment(paymentParameters, promptParameters);
      console.log('Payment successful:', payment);
    } catch (error) {
      const failure = mapUserInfoToFailure(error.userInfo);
      console.log('Payment error:', JSON.stringify(failure));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Admin Header (Settings, Permissions, Close Admin) */}
      {isAdmin && (
        <View style={styles.adminHeader}>
          <HeaderButton 
            title="Settings" 
            onPress={() => {
              // Insert your showSettings function here.
            }} 
          />
          <HeaderButton 
            title="Permissions" 
            onPress={() => navigation.navigate('Permissions')} 
          />
          <HeaderButton 
            title="Close Admin" 
            onPress={() => {
              setIsAdmin(false);
              setDevice(null);
            }} 
          />
        </View>
      )}

      {/* Extra Admin Buttons for Bluetooth Commands */}
      {isAdmin && (
        <View style={styles.adminButtons}>
          <TouchableOpacity style={styles.btButton} onPress={sendCommandA}>
            <Text style={styles.btButtonText}>A</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btButton} onPress={sendCommandB}>
            <Text style={styles.btButtonText}>B</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.title} onLongPress={handleLongPress}>
          Menu
        </Text>
        <View style={styles.itemsContainer}>
          {/* Water Item */}
          <View style={styles.item}>
            <Text style={styles.itemName}>Water</Text>
            <Text style={styles.itemPrice}>$1.99</Text>
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                onPress={() => setWaterQuantity(Math.max(0, waterQuantity - 1))}
                style={styles.quantityButton}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantityText}>{waterQuantity}</Text>
              <TouchableOpacity
                onPress={() => setWaterQuantity(waterQuantity + 1)}
                style={styles.quantityButton}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Prime Item */}
          <View style={styles.item}>
            <Text style={styles.itemName}>Prime</Text>
            <Text style={styles.itemPrice}>$2.99</Text>
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                onPress={() => setPrimeQuantity(Math.max(0, primeQuantity - 1))}
                style={styles.quantityButton}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantityText}>{primeQuantity}</Text>
              <TouchableOpacity
                onPress={() => setPrimeQuantity(primeQuantity + 1)}
                style={styles.quantityButton}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Section: Total Amount and Payment Button */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalText}>Total: ${totalAmount}</Text>
        <LoadingButton
          isLoading={false}
          isActive={true}
          handleOnPress={handleStartPayment}
          activeLabel={`Buy for $${totalAmount}`}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
  },
  adminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  adminButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  btButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  btButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  itemsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  item: {
    alignItems: 'center',
    width: '45%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  itemName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    color: '#555',
    marginBottom: 10,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    padding: 8,
    backgroundColor: '#ddd',
    borderRadius: 4,
    marginHorizontal: 10,
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 18,
  },
  totalContainer: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  totalText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

export default HomeView;
