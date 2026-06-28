import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Upload a payment-proof file to Storage and return its download URL.
 * Path: proofs/{uid}/{instanceId}/{filename}. Throws if Storage isn't enabled.
 */
export async function uploadProof(uid: string, instanceId: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r = ref(storage, `proofs/${uid}/${instanceId}/${Date.now()}_${safe}`);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}
