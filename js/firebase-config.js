const firebaseConfig = {
  apiKey: "AIzaSyCApr2cZjtmL-wlPUdML5RageT9oZxC7GM",
  authDomain: "clinica-dr-allan-leal.firebaseapp.com",
  projectId: "clinica-dr-allan-leal",
  storageBucket: "clinica-dr-allan-leal.firebasestorage.app",
  messagingSenderId: "296066236776",
  appId: "1:296066236776:web:72769f24e1b208b71916dd"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth ? firebase.auth() : null;
