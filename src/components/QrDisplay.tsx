"use client";

import { QRCodeSVG } from "qrcode.react";

export default function QrDisplay({
  eventId,
  token,
  size = 200,
}: {
  eventId: number;
  token: string;
  size?: number;
}) {
  return (
    <QRCodeSVG
      value={`${eventId}:${token}`}
      size={size}
      level="M"
      marginSize={2}
      className="rounded-lg"
    />
  );
}