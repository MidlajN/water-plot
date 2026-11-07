import { CanvasProvider } from "@/features/workspace/canvas/CanvasContext";
import { WorkspaceSurface } from "@/features/workspace/components/WorkspaceSurface";

export default function Home() {
  return (
    <CanvasProvider>
      <WorkspaceSurface />
    </CanvasProvider>
  );
}