// يتولد مرة لكل ضغطة مستخدم، ويُعاد استخدامه بس لو إعادة محاولة بعد فشل شبكة
export const newIdempotencyKey = (): string => crypto.randomUUID();