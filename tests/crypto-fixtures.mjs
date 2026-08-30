import { createHash, generateKeyPairSync } from "node:crypto";

export function createForeignSigningKey(kind) {
  const { privateKey, publicKey } =
    kind === "rsa"
      ? generateKeyPairSync("rsa", { modulusLength: 2048 })
      : generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicKeyPem = publicKey
    .export({ format: "pem", type: "spki" })
    .toString();
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  return {
    key_id: `sha256:${createHash("sha256").update(publicKeyDer).digest("hex")}`,
    private_key: privateKey,
    public_key_pem: publicKeyPem
  };
}
