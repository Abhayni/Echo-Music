import type { ProviderHealth } from "./types";

export function getProviderDisplayStatus(provider: ProviderHealth) {
  if (provider.id === "youtube-music" && provider.available && provider.searchAvailable) {
    return "Search Only · authorized audio matching";
  }
  if (provider.status === "unavailable") return "Connection Unavailable";
  if (provider.status === "healthy") {
    if (provider.playbackAvailable) return "Connected · Playback Supported";
    if (provider.searchAvailable) return "Connected · Search Only";
    return "Connected";
  }
  if (provider.credentialRequirement.startsWith("Required:")) return "Credentials Missing";
  return "Unsupported";
}
