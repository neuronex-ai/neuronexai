export const normalizeBrazilianPhoneDigits = (value: string) => {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  return digits;
};

export const formatBrazilianPhone = (value: string) => {
  const digits = normalizeBrazilianPhoneDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const local = digits.slice(2);
  const firstBlockLength = local.length > 8 ? 5 : 4;
  const firstBlock = local.slice(0, firstBlockLength);
  const secondBlock = local.slice(firstBlockLength, firstBlockLength + 4);

  return `(${ddd}) ${firstBlock}${secondBlock ? `-${secondBlock}` : ""}`;
};

export const isValidBrazilianPhone = (value: string) => {
  const digits = normalizeBrazilianPhoneDigits(value);
  return digits.length === 10 || (digits.length === 11 && digits.charAt(2) === "9");
};
