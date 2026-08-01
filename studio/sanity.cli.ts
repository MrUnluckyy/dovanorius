import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: "d46477b3",
    dataset: "production",
  },
  // Hosted Studio hostname → https://noriuto.sanity.studio
  studioHost: "noriuto",
  // Hosted Studio picks up Sanity bugfixes without a redeploy.
  deployment: { autoUpdates: true, appId: "jh067lepfnvp0zymbfe1llrf" },
});
