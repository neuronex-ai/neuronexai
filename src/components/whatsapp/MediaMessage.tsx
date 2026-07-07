import {
  FileText,
  Image as ImageIcon,
  MapPin,
  PhoneCall,
  SmilePlus,
  UserRound,
  Video,
  Volume2,
} from "lucide-react";
import type React from "react";

import { cn } from "@/lib/utils";

type MediaMetadata = Record<string, any> | null | undefined;

type MediaMessageProps = {
  contentType?: string | null;
  content?: string | null;
  mediaBase64?: string | null;
  mediaMimetype?: string | null;
  mediaFilename?: string | null;
  mediaUrl?: string | null;
  metadata?: MediaMetadata;
  direction?: string | null;
};

const toMediaSrc = (mediaBase64?: string | null, mediaMimetype?: string | null, mediaUrl?: string | null) => {
  if (mediaUrl) return mediaUrl;
  if (!mediaBase64) return null;
  if (/^https?:\/\//i.test(mediaBase64) || mediaBase64.startsWith("data:")) return mediaBase64;
  return `data:${mediaMimetype || "application/octet-stream"};base64,${mediaBase64}`;
};

const metadataValue = (metadata: MediaMetadata, keys: string[]) => {
  if (!metadata || typeof metadata !== "object") return "";
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
};

const parseCoordinate = (metadata: MediaMetadata, keys: string[]) => {
  const raw = metadataValue(metadata, keys);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

function AttachmentShell({
  icon: Icon,
  title,
  detail,
  href,
  outbound,
}: {
  icon: React.ElementType<{ className?: string }>;
  title: string;
  detail?: string | null;
  href?: string | null;
  outbound?: boolean;
}) {
  const content = (
    <>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", outbound ? "bg-black/5" : "bg-white/[0.06]")}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black">{title}</span>
        {detail ? <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-60">{detail}</span> : null}
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-2xl border p-3 transition-colors",
          outbound ? "border-black/10 bg-black/5 text-black hover:bg-black/10" : "border-white/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.07]",
        )}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl border p-3",
        outbound ? "border-black/10 bg-black/5 text-black" : "border-white/10 bg-white/[0.04] text-zinc-100",
      )}
    >
      {content}
    </div>
  );
}

export function MediaMessage({
  contentType,
  content,
  mediaBase64,
  mediaMimetype,
  mediaFilename,
  mediaUrl,
  metadata,
  direction,
}: MediaMessageProps) {
  const normalizedType = (contentType || "text").toLowerCase();
  const mediaSrc = toMediaSrc(mediaBase64, mediaMimetype, mediaUrl);
  const outbound = direction === "outbound";
  const body = content || metadataValue(metadata, ["caption", "text", "body", "message"]);

  if (normalizedType.includes("deleted")) {
    return <p className="text-xs font-bold italic opacity-60">Mensagem apagada.</p>;
  }

  if (normalizedType.includes("call")) {
    const callStatus = metadataValue(metadata, ["status", "callStatus", "type"]) || "Chamada registrada";
    return <AttachmentShell icon={PhoneCall} title="Chamada no WhatsApp" detail={callStatus} outbound={outbound} />;
  }

  if (normalizedType.includes("reaction")) {
    const reaction = metadataValue(metadata, ["reaction", "emoji", "text"]) || body || "Reação";
    return <AttachmentShell icon={SmilePlus} title="Reação" detail={reaction} outbound={outbound} />;
  }

  if (normalizedType.includes("location")) {
    const latitude = parseCoordinate(metadata, ["latitude", "lat"]);
    const longitude = parseCoordinate(metadata, ["longitude", "lng", "lon"]);
    const title = metadataValue(metadata, ["name", "title"]) || "Localização";
    const address = metadataValue(metadata, ["address", "description"]);
    const href = latitude !== null && longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      : null;
    return <AttachmentShell icon={MapPin} title={title} detail={address || body || "Abrir mapa"} href={href} outbound={outbound} />;
  }

  if (normalizedType.includes("contact") || normalizedType.includes("vcard")) {
    const name = metadataValue(metadata, ["displayName", "name", "fullName"]) || "Contato compartilhado";
    const phone = metadataValue(metadata, ["phone", "waid", "number"]);
    return <AttachmentShell icon={UserRound} title={name} detail={phone} outbound={outbound} />;
  }

  if ((normalizedType.includes("image") || normalizedType.includes("sticker")) && mediaSrc) {
    return (
      <div className="space-y-2">
        <img
          src={mediaSrc}
          alt={mediaFilename || "Imagem enviada pelo WhatsApp"}
          className="max-h-80 rounded-2xl object-contain"
        />
        {body ? <p className="whitespace-pre-wrap break-words">{body}</p> : null}
      </div>
    );
  }

  if (normalizedType.includes("video") && mediaSrc) {
    return (
      <div className="space-y-2">
        <video controls src={mediaSrc} className="max-h-80 max-w-full rounded-2xl" />
        {body ? <p className="whitespace-pre-wrap break-words">{body}</p> : null}
      </div>
    );
  }

  if ((normalizedType.includes("audio") || normalizedType.includes("ptt")) && mediaSrc) {
    return (
      <div className="space-y-2">
        <audio controls src={mediaSrc} className="max-w-full" />
        {body ? <p className="whitespace-pre-wrap break-words">{body}</p> : null}
      </div>
    );
  }

  if ((normalizedType.includes("document") || normalizedType.includes("file")) && mediaSrc) {
    return (
      <AttachmentShell
        icon={FileText}
        title={mediaFilename || body || "Documento"}
        detail={mediaMimetype}
        href={mediaSrc}
        outbound={outbound}
      />
    );
  }

  if ((normalizedType.includes("image") || normalizedType.includes("video")) && !mediaSrc) {
    return <AttachmentShell icon={normalizedType.includes("video") ? Video : ImageIcon} title="Mídia aguardando sincronização" detail={body} outbound={outbound} />;
  }

  if ((normalizedType.includes("audio") || normalizedType.includes("ptt")) && !mediaSrc) {
    return <AttachmentShell icon={Volume2} title="Áudio aguardando sincronização" detail={body} outbound={outbound} />;
  }

  if ((normalizedType.includes("document") || normalizedType.includes("file")) && !mediaSrc) {
    return <AttachmentShell icon={FileText} title="Documento aguardando sincronização" detail={body} outbound={outbound} />;
  }

  return <p className="whitespace-pre-wrap break-words">{body || ""}</p>;
}
