import { notFound } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { SharePlaylist } from "@/lib/types";
import { ClipCard } from "@/components/ClipCard";

async function getSharedPlaylist(token: string): Promise<SharePlaylist> {
  try {
    const res = await apiFetch<{ playlist: SharePlaylist }>(`/share/${token}`);
    return res.playlist;
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const playlist = await getSharedPlaylist(params.token);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{playlist.name}</h1>
        {playlist.description && <p className="text-slate-600">{playlist.description}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {playlist.clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} readOnly />
        ))}
      </div>
    </div>
  );
}
