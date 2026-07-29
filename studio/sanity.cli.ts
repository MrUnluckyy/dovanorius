import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: "d46477b3",
    dataset: "production",
  },
  // Hosted Studio picks up Sanity bugfixes without a redeploy.
  deployment: { autoUpdates: true },
});
