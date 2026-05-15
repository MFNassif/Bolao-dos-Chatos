/**
 * Inicializa firebase-admin a partir de uma conta de serviço.
 * Aceita JSON em base64 (FIREBASE_SERVICE_ACCOUNT_B64) ou path para arquivo (GOOGLE_APPLICATION_CREDENTIALS).
 */
const admin = require('firebase-admin');

function init() {
  if (admin.apps.length) return admin;

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(json) });
    return admin;
  }
  // Fallback: GOOGLE_APPLICATION_CREDENTIALS aponta para um arquivo
  admin.initializeApp();
  return admin;
}

module.exports = { admin: init(), db: () => init().firestore(), FieldValue: admin.firestore.FieldValue };
