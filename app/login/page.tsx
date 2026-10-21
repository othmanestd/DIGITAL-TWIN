import type { Metadata } from "next";
import GateShell from "@/components/gate/GateShell";
import LoginForm from "@/components/gate/LoginForm";

export const metadata: Metadata = { title: "Connexion · Akdital augmenté" };

export default function LoginPage() {
  return (
    <GateShell>
      <LoginForm />
    </GateShell>
  );
}
