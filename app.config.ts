import { ExpoConfig, ConfigContext } from "expo/config";
import appJson from "./app.json";

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = appJson.expo || config;
  const isProd = process.env.NODE_ENV === "production";
  const allowCleartextDev =
    !isProd && process.env.AXON_ALLOW_CLEARTEXT_DEV === "true";
  const androidConfig = {
    ...(base.android || {}),
    usesCleartextTraffic: allowCleartextDev,
  } as ExpoConfig["android"];

  return {
    ...base,
    android: androidConfig,
  };
};
