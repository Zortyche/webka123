// Firebase initialization (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Firebase config (from user-provided values) - для аутентификации
const firebaseConfig = {
  apiKey: "AIzaSyDAB3fJSEHtIk4DePqdky7wUs6pNl4V0Zs",
  authDomain: "bdweb-7467a.firebaseapp.com",
  projectId: "bdweb-7467a",
  storageBucket: "bdweb-7467a.firebasestorage.app",
  messagingSenderId: "1016287437140",
  appId: "1:1016287437140:web:7e11d9afa8bfb41d4328c1",
  measurementId: "G-G9J8X1DBG3"
};

// Вторая Firebase конфигурация - для товаров и сотрудников
const firebaseConfig2 = {
  apiKey: "AIzaSyAfnC3bHt36nYZ4y0XUxAnml-ClOfwtCXw",
  authDomain: "wbbd2-8a1ac.firebaseapp.com",
  projectId: "wbbd2-8a1ac",
  storageBucket: "wbbd2-8a1ac.firebasestorage.app",
  messagingSenderId: "938386051536",
  appId: "1:938386051536:web:02f1f9ff2763ff05c629d5",
  measurementId: "G-J6VF4FGNCZ"
};

// Initialize Firebase
let app, auth, db, storage, analytics;
// Вторая Firebase инициализация для товаров и сотрудников
let app2, db2;

// Check protocol - Firebase requires http/https, not file://
if (window.location.protocol === 'file:') {
  console.warn('⚠️ Firebase может не работать с file:// протоколом. Используйте локальный сервер (например, Live Server в VS Code)');
}

try {
  console.log('Initializing Firebase...', {
    projectId: firebaseConfig.projectId,
    protocol: window.location.protocol
  });
  
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized');
  
  auth = getAuth(app);
  console.log('✅ Firebase Auth initialized');
  
  db = getFirestore(app);
  console.log('✅ Firestore initialized');
  
  storage = getStorage(app);
  console.log('✅ Firebase Storage initialized');
  
  // Analytics only in production/HTTPS
  if (window.location.protocol === 'https:') {
    try {
      analytics = getAnalytics(app);
      console.log('✅ Firebase Analytics initialized');
    } catch (analyticsError) {
      console.warn('Analytics initialization skipped:', analyticsError);
    }
  }
  
  console.log('✅ All Firebase services initialized successfully');
  
  // Инициализация второй Firebase конфигурации (для товаров и сотрудников)
  try {
    app2 = initializeApp(firebaseConfig2, 'productsApp');
    console.log('✅ Firebase app2 (products) initialized');
    db2 = getFirestore(app2);
    console.log('✅ Firestore db2 (products) initialized');
  } catch (error2) {
    console.error("❌ Firebase app2 initialization error:", error2);
    // Не прерываем выполнение, если вторая БД не инициализировалась
  }
} catch (error) {
  console.error("❌ Firebase initialization error:", error);
  console.error("Error details:", {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
  throw error;
}

// Upload avatar function with error handling
async function uploadAvatar(file, uid) {
  if (!file || !uid) {
    console.error("File or UID is missing for avatar upload");
    return null;
  }
  
  try {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload an image (JPEG, PNG, GIF, WebP).');
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum size is 5MB.');
    }
    
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `avatars/${uid}/${timestamp}_${sanitizedName}`;
    const avatarRef = ref(storage, path);
    
    await uploadBytes(avatarRef, file);
    const url = await getDownloadURL(avatarRef);
    return url;
  } catch (error) {
    console.error("Avatar upload error:", error);
    throw error;
  }
}

// Create user with profile data in Firestore
async function createUserWithProfile(email, password, userData = {}) {
  // Validate Firebase is initialized
  if (!auth) {
    throw new Error("Firebase Auth is not initialized. Please wait for Firebase to load.");
  }
  if (!db) {
    throw new Error("Firestore is not initialized. Please wait for Firebase to load.");
  }
  
  try {
    console.log("Starting user creation process...", { email, hasDisplayName: !!userData.displayName });
    
    // Create user in Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log("✅ User created in Auth successfully:", user.uid, user.email);
    
    // Update profile in Authentication
    if (userData.displayName) {
      await updateProfile(user, {
        displayName: userData.displayName,
        photoURL: userData.photoURL || null
      });
      console.log("Profile updated in Auth");
    }
    
    // Create user document in Firestore
    // Extract photoURL separately to avoid conflicts
    const { photoURL, ...otherUserData } = userData;
    const userDoc = {
      email: user.email,
      displayName: userData.displayName || '',
      photoURL: photoURL || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      uid: user.uid,
      ...otherUserData // Spread additional user data (without photoURL)
    };
    
    console.log("Creating Firestore document for user:", user.uid);
    await setDoc(doc(db, 'users', user.uid), userDoc);
    console.log("Firestore document created successfully for user:", user.uid);
    
    return userCredential;
  } catch (error) {
    console.error("User creation error:", error);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Set user document with validation
async function setUserDoc(uid, data, merge = true) {
  if (!uid) {
    throw new Error("UID is required to set user document");
  }
  
  if (!db) {
    throw new Error("Firestore database is not initialized");
  }
  
  try {
    const userDoc = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    console.log("Updating Firestore document for user:", uid, "with data:", userDoc);
    await setDoc(doc(db, 'users', uid), userDoc, { merge });
    console.log("User document saved successfully for:", uid);
  } catch (error) {
    console.error("Error saving user document:", error);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      uid: uid,
      stack: error.stack
    });
    throw error;
  }
}

// Get current user document
async function getCurrentUserDoc() {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      return userDocSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error getting user document:", error);
    return null;
  }
}

// Initialize Firebase and handle ready state
// Create promise that resolves when Firebase is ready
// Use setTimeout to ensure initialization happens after module loads
window.firebaseReady = new Promise((resolve, reject) => {
  // Use setTimeout to ensure all code above has executed
  setTimeout(() => {
    try {
      // Check if Firebase is initialized
      if (!app || !auth || !db) {
        const error = new Error("Firebase failed to initialize - app, auth, or db is null");
        console.error("❌ Firebase initialization failed:", {
          app: !!app,
          auth: !!auth,
          db: !!db,
          storage: !!storage
        });
        reject(error);
        return;
      }
      
      console.log('✅ Firebase services verified:', {
        app: !!app,
        auth: !!auth,
        db: !!db,
        storage: !!storage
      });
      
      // Resolve with all Firebase services
      resolve({ 
        app, 
        auth, 
        db, 
        storage, 
        analytics,
        isInitialized: true
      });
    } catch (error) {
      console.error("❌ Error in firebaseReady promise:", error);
      reject(error);
    }
  }, 100); // Small delay to ensure module is fully loaded
});

// Expose Firebase services and utilities on window
window.firebase = {
  // Core services
  app,
  auth,
  db,
  storage,
  analytics,
  // Вторая база данных для товаров и сотрудников
  app2,
  db2,
  
  // Authentication methods
  createUserWithEmailAndPassword: (email, password) => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }
    return createUserWithEmailAndPassword(auth, email, password);
  },
  
  signInWithEmailAndPassword: (email, password) => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }
    return signInWithEmailAndPassword(auth, email, password);
  },
  
  updateProfile: (user, props) => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }
    return updateProfile(user, props);
  },
  
  onAuthStateChanged: (callback) => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }
    return onAuthStateChanged(auth, callback);
  },
  
  // Custom functions
  uploadAvatar,
  createUserWithProfile,
  setUserDoc,
  getCurrentUserDoc,
  
  // Helper to get current user data
  getCurrentUser: () => auth ? auth.currentUser : null,
  
  // Check if user is authenticated
  isAuthenticated: () => auth ? !!auth.currentUser : false,
  
  // Logout function
  logout: async () => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }
    try {
      await auth.signOut();
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }
};

console.log('Firebase initialized successfully:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  timestamp: new Date().toISOString(),
  authInitialized: !!auth,
  dbInitialized: !!db
});

// Export for module usage (if needed)
export { 
  app, 
  auth, 
  db, 
  storage, 
  analytics,
  app2,
  db2,
  uploadAvatar,
  createUserWithProfile,
  setUserDoc,
  getCurrentUserDoc
};