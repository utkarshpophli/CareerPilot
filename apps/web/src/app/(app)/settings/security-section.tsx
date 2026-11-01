"use client";

import { useState } from "react";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { signOutEverywhere } from "./actions";
import { SettingsSectionIntro } from "./settings-screen";

/** Settings → Security: ending every session at once, for a lost device or a cookie that may have been copied. */
export function SecuritySection() {
  const [working, setWorking] = useState(false);

  const signOut = async () => {
    setWorking(true);
    // On success the action takes you to the sign-in page.
    const result = await signOutEverywhere({});
    setWorking(false);
    if (result && !result.ok) toast(result.error);
  };

  return (
    <>
      <SettingsSectionIntro title="Security">
        Signing out from the sidebar ends the session in this browser. If a device was lost, or you think a sign-in cookie was copied, end every session on every device
        at once.
      </SettingsSectionIntro>
      <Card className="flex flex-col gap-3">
        <p>
          This signs out every browser that is signed in, including this one, and you will need your password to come back. API tokens keep working; revoke those
          under API tokens. Changing your password in the server settings and restarting does the same.
        </p>
        <div>
          <Button variant="secondary" onClick={() => void signOut()} disabled={working}>
            Sign out everywhere
          </Button>
        </div>
      </Card>
    </>
  );
}
