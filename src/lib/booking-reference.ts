
const PREFIX = "SBK-";

export function formatBookingReference(id: string): string {
  const hex = id.replace(/-/g, "");

  if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw new Error("Invalid booking ID");
  }

  return PREFIX + BigInt(`0x${hex}`).toString(36).toUpperCase();
}

export function parseBookingReference(reference: string): string {
  const value = reference.trim().toUpperCase();

  if (!value.startsWith(PREFIX)) {
    throw new Error("Enter a valid Slotbook booking reference");
  }

  const encoded = value.slice(PREFIX.length);

  if (!/^[0-9A-Z]+$/.test(encoded)) {
    throw new Error("Invalid booking reference");
  }

  const idHex = BigInt(parseBase36(encoded))
    .toString(16)
    .padStart(32, "0");

  if (idHex.length !== 32) {
    throw new Error("Invalid booking reference");
  }

  return [
    idHex.slice(0, 8),
    idHex.slice(8, 12),
    idHex.slice(12, 16),
    idHex.slice(16, 20),
    idHex.slice(20),
  ].join("-");
}

function parseBase36(value: string): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = BigInt(0);

  for (const character of value) {
    const digit = alphabet.indexOf(character);

    if (digit < 0) {
      throw new Error("Invalid booking reference");
    }

    result = result * BigInt(36) + BigInt(digit);
  }

  return result.toString(10);
}
