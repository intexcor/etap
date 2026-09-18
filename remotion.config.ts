// Конфиг Remotion CLI (npm run studio / remotion render). Node-API рендера (server/render.ts) его не читает.
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
