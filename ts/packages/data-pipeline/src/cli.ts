import { buildFullStandardCardJson } from "./buildCardJson.js";

async function main() {
  const outputDir = process.argv[2] || "./out";

  try {
    await buildFullStandardCardJson(outputDir);
    console.log("✓ Complete standard format cards built successfully");
    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to build cards:", error);
    process.exit(1);
  }
}

main();
