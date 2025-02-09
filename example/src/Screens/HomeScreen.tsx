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

// HM10 default UUIDs (ensure these match your module)
const HM10_SERVICE_UUID = '0000FFE0-0000-1000-8000-00805F9B34FB';
const HM10_CHARACTERISTIC_UUID = '0000FFE1-0000-1000-8000-00805F9B34FB';

const HomeView = () => {
  const navigation = useNavigation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [waterQuantity, setWaterQuantity] = useState(0);
  const [primeQuantity, setPrimeQuantity] = useState(0);
  // Prices changed to 0.01 and 0.02
  const totalAmount = (waterQuantity * 0.01 + primeQuantity * 0.02).toFixed(2);

  // BLE variables
  const [bleManager] = useState(new BleManager());
  const [device, setDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Long press on "Menu" prompts admin login
  const handleLongPress = () => {
    if (!isAdmin) {
      Alert.prompt("Admin Login", "Enter password", (password) => {
        if (password === "8888") {
          setIsAdmin(true);
        } else {
          Alert.alert("Incorrect Password");
        }
      });
    }
  };

  // When admin mode is enabled, try to connect to the BT device
  useEffect(() => {
    if (isAdmin && !device && !isConnecting) {
      connectToDevice();
    }
  }, [isAdmin]);

  const connectToDevice = () => {
    setIsConnecting(true);
    console.log("Starting device scan...");
    bleManager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        Alert.alert("Bluetooth Error", error.message);
        setIsConnecting(false);
        return;
      }
      if (scannedDevice && scannedDevice.name && scannedDevice.name.includes("DSD TECH")) {
        console.log("Device found:", scannedDevice.name);
        bleManager.stopDeviceScan();
        scannedDevice.connect()
          .then(device => device.discoverAllServicesAndCharacteristics())
          .then(device => {
            setDevice(device);
            setIsConnecting(false);
            Alert.alert("Connected", "Connected to DSD TECH device");
          })
          .catch(error => {
            Alert.alert("Connection Error", error.message);
            setIsConnecting(false);
          });
      }
    });
    setTimeout(() => {
      bleManager.stopDeviceScan();
      if (!device) {
        Alert.alert("Connection Timeout", "Could not find device");
        setIsConnecting(false);
      }
    }, 10000);
  };

  // Send command (encoded in base64 as required by the BLE library)
  const sendBluetoothCommand = async (command) => {
    if (!device) {
      Alert.alert("Error", "Not connected to device");
      return;
    }
    try {
      console.log("Sending command:", command);
      const commandBase64 = base64.encode(command);
      await bleManager.writeCharacteristicWithoutResponseForDevice(
        device.id,
        HM10_SERVICE_UUID,
        HM10_CHARACTERISTIC_UUID,
        commandBase64
      );
      Alert.alert("Success", `Command "${command}" sent successfully`);
    } catch (error) {
      Alert.alert("Send Error", error.message);
    }
  };

  // Test buttons:
  // Send "1,0" to run Motor A (water) one time.
  const sendTestCommandWater = () => sendBluetoothCommand("1,0");
  // Send "0,1" to run Motor B (prime) one time.
  const sendTestCommandPrime = () => sendBluetoothCommand("0,1");

  // After payment, send dispense command in format "waterQuantity,primeQuantity"
  const sendDispenseCommand = () => {
    const command = `${waterQuantity},${primeQuantity}`;
    sendBluetoothCommand(command);
  };

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
      console.log("Payment successful:", payment);
      sendDispenseCommand();
    } catch (error) {
      const failure = mapUserInfoToFailure(error.userInfo);
      console.log("Payment error:", JSON.stringify(failure));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {isAdmin && (
        <View style={styles.adminHeader}>
          <HeaderButton title="Settings" onPress={() => {}} />
          <HeaderButton title="Permissions" onPress={() => navigation.navigate('Permissions')} />
          <HeaderButton title="Close Admin" onPress={() => {
              setIsAdmin(false);
              setDevice(null);
            }} />
        </View>
      )}

      {isAdmin && (
        <View style={styles.adminButtons}>
          <TouchableOpacity style={styles.btButton} onPress={sendTestCommandWater}>
            <Text style={styles.btButtonText}>Test Water</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btButton} onPress={sendTestCommandPrime}>
            <Text style={styles.btButtonText}>Test Prime</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.title} onLongPress={handleLongPress}>Menu</Text>
        <View style={styles.itemsContainer}>
          <View style={styles.item}>
            <Text style={styles.itemName}>Water</Text>
            <Text style={styles.itemPrice}>$0.01</Text>
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
          <View style={styles.item}>
            <Text style={styles.itemName}>Prime</Text>
            <Text style={styles.itemPrice}>$0.02</Text>
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
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  adminHeader: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  adminButtons: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  btButton: { backgroundColor: '#4CAF50', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5 },
  btButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  itemsContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  item: { alignItems: 'center', width: '45%', padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  itemName: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  itemPrice: { fontSize: 16, color: '#555', marginBottom: 10 },
  quantityContainer: { flexDirection: 'row', alignItems: 'center' },
  quantityButton: { padding: 8, backgroundColor: '#ddd', borderRadius: 4, marginHorizontal: 10 },
  quantityButtonText: { fontSize: 20, fontWeight: 'bold' },
  quantityText: { fontSize: 18 },
  totalContainer: { paddingVertical: 20, borderTopWidth: 1, borderColor: '#ccc', alignItems: 'center' },
  totalText: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
});

export default HomeView;
