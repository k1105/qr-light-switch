import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function registerNode(
  userId: string,
  parentId: string | null
): Promise<void> {
  const ref = doc(db, "nodes", userId);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(ref, {
    parentId,
    createdAt: serverTimestamp(),
  });
}
