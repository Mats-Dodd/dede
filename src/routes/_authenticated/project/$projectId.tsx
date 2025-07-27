import { createFileRoute } from "@tanstack/react-router"
import TabManager from "@/components/tab-manager"

export const Route = createFileRoute("/_authenticated/project/$projectId")({
  component: ProjectPage,
  ssr: false,
})

function ProjectPage() {
  return (
    <div className="h-full">
      <TabManager />
    </div>
  )
}
