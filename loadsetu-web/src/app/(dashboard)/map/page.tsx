"use client";

// app/(dashboard)/map/page.tsx
import dynamic from "next/dynamic";

const GodView = dynamic(
  () => import("@/components/features/LiveMap/GodView"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading map engine...</p>
        </div>
      </div>
    ),
  }
);

export default function MapPage() {
  return (
    <div className="w-full h-full">
      <GodView />
    </div>
  );
}
