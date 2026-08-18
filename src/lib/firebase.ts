import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { TVDevice } from '../types';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore using the provisioned databaseId
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const DEVICES_COLLECTION = 'devices';

/**
 * Subscribe to real-time changes in TV devices from Firestore
 */
export function subscribeToDevices(
  onUpdate: (devices: TVDevice[]) => void,
  onError?: (error: Error) => void
) {
  try {
    const devicesRef = collection(db, DEVICES_COLLECTION);
    const q = query(devicesRef);
    
    return onSnapshot(q, (snapshot) => {
      const devices: TVDevice[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        devices.push({
          id: docSnap.id,
          name: data.name || 'TV Sem Nome',
          location: data.location || '',
          folderUrl: data.folderUrl || '',
          folderId: data.folderId || '',
          folderName: data.folderName || '',
          trainSchedules: Array.isArray(data.trainSchedules) ? data.trainSchedules : [],
          transitionSpeed: data.transitionSpeed || 15000,
          transitionEffect: data.transitionEffect || 'fade',
          showFileName: data.showFileName ?? true,
          showClock: data.showClock ?? true,
          showUiInSlideshow: data.showUiInSlideshow ?? false,
          autoRefresh: data.autoRefresh ?? true,
          autoRefreshRate: data.autoRefreshRate || 60000,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });

      // Sort by creation or name
      devices.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      onUpdate(devices);
    }, (error) => {
      console.error('Erro na subscrição em tempo real do Firestore:', error);
      if (onError) onError(error);
    });
  } catch (err: any) {
    console.error('Erro ao inicializar listener do Firestore:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Save or update a TV Device in Firestore
 */
export async function saveDeviceToFirestore(device: TVDevice): Promise<void> {
  const deviceRef = doc(db, DEVICES_COLLECTION, device.id);
  const dataToSave = {
    id: device.id,
    name: device.name,
    location: device.location || '',
    folderUrl: device.folderUrl || '',
    folderId: device.folderId || '',
    folderName: device.folderName || '',
    trainSchedules: device.trainSchedules || [],
    transitionSpeed: device.transitionSpeed || 15000,
    transitionEffect: device.transitionEffect || 'fade',
    showFileName: device.showFileName ?? true,
    showClock: device.showClock ?? true,
    showUiInSlideshow: device.showUiInSlideshow ?? false,
    autoRefresh: device.autoRefresh ?? true,
    autoRefreshRate: device.autoRefreshRate || 60000,
    createdAt: device.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(deviceRef, dataToSave, { merge: true });
}

/**
 * Delete a TV Device from Firestore
 */
export async function deleteDeviceFromFirestore(deviceId: string): Promise<void> {
  const deviceRef = doc(db, DEVICES_COLLECTION, deviceId);
  await deleteDoc(deviceRef);
}

/**
 * Fetch all TV devices once from Firestore
 */
export async function fetchDevicesFromFirestore(): Promise<TVDevice[]> {
  try {
    const devicesRef = collection(db, DEVICES_COLLECTION);
    const snapshot = await getDocs(devicesRef);
    const devices: TVDevice[] = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      devices.push({
        id: docSnap.id,
        name: data.name || 'TV Sem Nome',
        location: data.location || '',
        folderUrl: data.folderUrl || '',
        folderId: data.folderId || '',
        folderName: data.folderName || '',
        trainSchedules: Array.isArray(data.trainSchedules) ? data.trainSchedules : [],
        transitionSpeed: data.transitionSpeed || 15000,
        transitionEffect: data.transitionEffect || 'fade',
        showFileName: data.showFileName ?? true,
        showClock: data.showClock ?? true,
        showUiInSlideshow: data.showUiInSlideshow ?? false,
        autoRefresh: data.autoRefresh ?? true,
        autoRefreshRate: data.autoRefreshRate || 60000,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    });

    return devices;
  } catch (error) {
    console.error('Erro ao buscar dispositivos no Firestore:', error);
    return [];
  }
}
