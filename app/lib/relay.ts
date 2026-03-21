import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function registerNode(
  userId: string,
  parentId: string | null,
  options?: { isGoal?: boolean }
): Promise<void> {
  const ref = doc(db, "nodes", userId);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(ref, {
    parentId,
    state: "off",
    createdAt: serverTimestamp(),
    ...(options?.isGoal && { isGoal: true }),
  });
}

export async function updateState(
  userId: string,
  state: "on" | "off"
): Promise<void> {
  const ref = doc(db, "nodes", userId);
  await updateDoc(ref, { state });
}
