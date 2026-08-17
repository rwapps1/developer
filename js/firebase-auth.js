  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
  import {
    getAuth, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    GoogleAuthProvider, signInWithRedirect, getRedirectResult,
    sendPasswordResetEmail,
    signOut
  } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
  import {
    getFirestore, doc, getDoc, setDoc, serverTimestamp
  } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

  const firebaseConfig = {
    apiKey: "AIzaSyBa47dn0gfyqYtF07i7EEsUCJtYIPZs5NM",
    authDomain: "palabra-f8778.firebaseapp.com",
    projectId: "palabra-f8778",
    storageBucket: "palabra-f8778.firebasestorage.app",
    messagingSenderId: "291018112525",
    appId: "1:291018112525:web:2e53769bf8952131e19f44"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const googleProvider = new GoogleAuthProvider();

  window.PalabraAuth = {
    onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb),
    signUp: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    signInWithGoogle: () => signInWithRedirect(auth, googleProvider),
    getRedirectResult: () => getRedirectResult(auth),
    signOut: () => signOut(auth),
    getUserDoc: (uid) => getDoc(doc(db, 'users', uid)),
    setUserDoc: (uid, data) => setDoc(doc(db, 'users', uid), data, { merge: true }),
    serverTimestamp
  };

  window.dispatchEvent(new CustomEvent('palabra-firebase-ready'));
