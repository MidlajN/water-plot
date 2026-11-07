import { WorkspaceSurface } from "@/features/workspace/components/WorkspaceSurface";
import { WorkspaceProviders } from "@/features/workspace/WorkspaceProvider";

export default function Home() {
  return (
    <WorkspaceProviders>
      <WorkspaceSurface />
    </WorkspaceProviders>
  );
}