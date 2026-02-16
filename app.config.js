const fs = require("fs");
const path = require("path");

const appJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "app.json"), "utf-8"),
);

module.exports = ({ config }) => {
  const base = appJson.expo || config;
  const isProd = process.env.NODE_ENV === "production";
  const allowCleartextDev =
    !isProd && process.env.AXON_ALLOW_CLEARTEXT_DEV === "true";
  const androidConfig = {
    ...(base.android || {}),
    usesCleartextTraffic: allowCleartextDev,
  };

  return {
    ...base,
    android: androidConfig,
  };
};
