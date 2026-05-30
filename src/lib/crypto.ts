export async function encryptText(text: string, password?: string): Promise<string> {
  if (!password) return text;
  if (!crypto.subtle) {
    console.warn("crypto.subtle is not available, skipping encryption");
    return text;
  }
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text)
  );
  
  const payload = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  payload.set(salt, 0);
  payload.set(iv, salt.length);
  payload.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < payload.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(payload.subarray(i, i + chunkSize)));
  }
  return "ENC:" + btoa(binary);
}

export async function decryptText(cipherText: string, password?: string): Promise<string> {
  if (!cipherText.startsWith("ENC:")) return cipherText;
  if (!password) throw new Error("需要密码来解密数据");
  if (!crypto.subtle) {
    console.warn("crypto.subtle is not available, cannot decrypt");
    throw new Error("当前环境不支持解密");
  }
  
  const b64 = cipherText.slice(4);
  const binary_string = atob(b64);
  const len = binary_string.length;
  const raw = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    raw[i] = binary_string.charCodeAt(i);
  }
  
  const salt = raw.slice(0, 16);
  const iv = raw.slice(16, 28);
  const data = raw.slice(28);
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["decrypt"]
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  return new TextDecoder().decode(decrypted);
}
