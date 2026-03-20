import { nanoid } from "nanoid";

const STORAGE_KEY = "qr-relay-user-id";

export function getUserId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = nanoid(12);
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
