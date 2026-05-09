import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChatView } from "./chat-view";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");

  return <ChatView userName={session.user.name ?? "Vous"} />;
}
